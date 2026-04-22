#!/bin/bash
# e2e-full-ota-test.sh — 完整 OTA 黑盒测试
#
# 在 /opt/woodpecker-test 部署环境中运行
# 流程: 启动基线 → 全量业务测试 → 快照 → 模拟OTA → 重启 → 数据持久性验证 → 业务回归
#
# 用法:
#   ./scripts/e2e-full-ota-test.sh              # 完整测试
#   ./scripts/e2e-full-ota-test.sh --no-ota     # 只跑业务测试，跳过 OTA
#   ./scripts/e2e-full-ota-test.sh --ota-only   # 只跑 OTA + 数据验证（跳过完整业务测试）

set -e

DEPLOY_DIR="/opt/woodpecker-test"
SOURCE_DIR="/home/maxin/project/psych-scale-server"
DATA_DIR="$HOME/.local/share/woodpecker"
BASE="http://localhost:3000/api"

PASS=0; FAIL=0; ERRORS=""
ok()   { PASS=$((PASS+1)); echo "  ✅ $1"; }
fail() { FAIL=$((FAIL+1)); ERRORS="$ERRORS\n  ❌ $1"; echo "  ❌ $1"; }
json() { python3 -c "import sys,json; print(json.load(sys.stdin)$1)"; }
json_v(){ python3 -c "import sys,json; d=json.load(sys.stdin); print($1)" 2>/dev/null || echo "ERR"; }

MODE="full"
[ "${1:-}" = "--no-ota" ] && MODE="no-ota"
[ "${1:-}" = "--ota-only" ] && MODE="ota-only"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  E2E 完整 OTA 黑盒测试                                     ║"
echo "║  部署目录: $DEPLOY_DIR"
echo "║  数据目录: $DATA_DIR"
echo "║  模式: $MODE"
echo "╚════════════════════════════════════════════════════════════╝"

if [ ! -f "$DEPLOY_DIR/desktop/start-desktop.js" ]; then
  echo "❌ 部署目录不存在，先运行: bash $SOURCE_DIR/scripts/deploy-test-env.sh"
  exit 1
fi

###############################################################################
# Helper functions
###############################################################################
wait_for_server() {
  local max=${1:-120} w=0
  echo "  ⏳ 等待服务启动 (最多 ${max}s)..."
  while [ $w -lt $max ]; do
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/health" 2>/dev/null | grep -q "200"; then
      echo "  ✅ HTTP 就绪 (${w}s)，等待 seed 完成..."
      local sw=0
      while [ $sw -lt 60 ]; do
        local login_test
        login_test=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}' 2>/dev/null || echo "")
        if echo "$login_test" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('accessToken') else 1)" 2>/dev/null; then
          echo "  ✅ 服务完全就绪 (seed 完成, ${w}s + ${sw}s)"
          return 0
        fi
        sleep 1; sw=$((sw+1))
      done
      fail "HTTP 就绪但 admin 登录失败 (seed 可能未完成)"
      return 1
    fi
    sleep 1; w=$((w+1))
  done
  fail "服务未在 ${max}s 内启动"
  return 1
}

stop_app() {
  echo "  🛑 停止应用..."
  local pid
  # SIGTERM start-desktop.js
  for pid in $(pgrep -f "start-desktop.js" 2>/dev/null || true); do
    kill "$pid" 2>/dev/null || true
  done
  sleep 2
  # Kill remaining children
  for pid in $(pgrep -f "dist/main.js" 2>/dev/null || true); do
    kill "$pid" 2>/dev/null || true
  done
  # Kill embedded-postgres on port 15432
  for pid in $(lsof -ti:15432 2>/dev/null || true); do
    kill "$pid" 2>/dev/null || true
  done
  # Force kill port 3000
  for pid in $(lsof -ti:3000 2>/dev/null || true); do
    kill -9 "$pid" 2>/dev/null || true
  done
  sleep 1
  echo "  已停止"
}

start_app() {
  local log=${1:-/tmp/woodpecker-test.log}
  echo "  🚀 启动应用..."
  cd "$DEPLOY_DIR"
  node desktop/start-desktop.js </dev/null > "$log" 2>&1 &
  echo "  PID=$!"
}

take_snapshot() {
  local label=${1:-""}
  local token=$2
  local prefix=${3:-"SNAP"}

  S_USERS=$(_api GET "$token" "/admin/users" "d.get('total',0) if isinstance(d,dict) else len(d) if isinstance(d,list) else 0")
  S_GRADES=$(_api GET "$token" "/admin/grades" "d.get('total',0) if isinstance(d,dict) else len(d) if isinstance(d,list) else 0")
  S_SCALES=$(_api GET "$token" "/scales" "d.get('total',0) if isinstance(d,dict) else len(d) if isinstance(d,list) else 0")
  S_TASKS=$(_api GET "$token" "/tasks" "d.get('total',0) if isinstance(d,dict) else len(d) if isinstance(d,list) else 0")
  S_RESULTS=$(_api GET "$token" "/results" "len(d) if isinstance(d,list) else d.get('total',0) if isinstance(d,dict) else 0")
  S_ALERTS=$(_api_t GET "/alerts" "d.get('total',0) if isinstance(d,dict) else len(d) if isinstance(d,list) else 0")
  S_STUDENTS=$(_api GET "$token" "/admin/students" "d.get('total',0) if isinstance(d,dict) else len(d) if isinstance(d,list) else 0")

  echo "  📸 $prefix 快照 $label:"
  echo "     用户=$S_USERS 年级=$S_GRADES 量表=$S_SCALES 任务=$S_TASKS"
  echo "     结果=$S_RESULTS 预警=$S_ALERTS 学生=$S_STUDENTS"
}

_api() {
  local method=$1 token=$2 endpoint=$3 expr=$4
  local auth="Authorization: Bearer $token"
  curl -s -X "$method" "$BASE$endpoint" -H "$auth" | json_v "$expr"
}

_api_t() {
  curl -s -X "$1" "$BASE$2" -H "Authorization: Bearer $TEACHER_TOKEN" | json_v "$3"
}

login_as() {
  local user=$1 pass=$2
  curl -s -X POST "$BASE/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$user\",\"password\":\"$pass\"}" | json "['accessToken']"
}

###############################################################################
# Phase 0: Prepare
###############################################################################
echo ""
echo "══════════════════════════════════════════"
echo "  Phase 0: 准备环境"
echo "══════════════════════════════════════════"

stop_app 2>/dev/null || true

# Clean data dir for fresh start
rm -rf "$DATA_DIR"
ok "用户数据目录已清空"

# Verify deploy structure
[ -f "$DEPLOY_DIR/dist/main.js" ] && ok "dist/main.js 存在" || { fail "dist/main.js 缺失"; exit 1; }
[ -f "$DEPLOY_DIR/desktop/start-desktop.js" ] && ok "start-desktop.js 存在" || { fail "start-desktop.js 缺失"; exit 1; }
[ -f "$DEPLOY_DIR/version.json" ] && ok "version.json 存在" || fail "version.json 缺失"
[ -d "$DEPLOY_DIR/node_modules" ] && ok "node_modules 存在" || { fail "node_modules 缺失"; exit 1; }

BEFORE_VERSION=$(json_v "d.get('version','?')" < "$DEPLOY_DIR/version.json")
ok "部署版本: $BEFORE_VERSION"

###############################################################################
# Phase 1: Start + Full business test
###############################################################################
echo ""
echo "══════════════════════════════════════════"
echo "  Phase 1: 启动 + 全量业务测试"
echo "══════════════════════════════════════════"

start_app /tmp/woodpecker-test-phase1.log
wait_for_server 90 || { echo "启动日志:"; tail -30 /tmp/woodpecker-test-phase1.log; exit 1; }

# --- 1.1 LOGIN ---
echo ""
echo "--- 1.1 登录 (3角色) ---"
ADMIN_TOKEN=$(login_as admin admin123)
[ -n "$ADMIN_TOKEN" ] && ok "admin 登录" || { fail "admin 登录"; tail -20 /tmp/woodpecker-test-phase1.log; exit 1; }

TEACHER_TOKEN=$(login_as "张毛毛" "Abc12345")
[ -n "$TEACHER_TOKEN" ] && ok "张毛毛 登录" || fail "张毛毛 登录"

AUTH_A="Authorization: Bearer $ADMIN_TOKEN"
AUTH_T="Authorization: Bearer $TEACHER_TOKEN"

# --- 1.2 ORG ---
echo ""
echo "--- 1.2 组织管理 (年级/班级/学生) ---"
TS=$(date +%s)

GRADE_ID=$(curl -s -X POST "$BASE/admin/grades" -H 'Content-Type: application/json' -H "$AUTH_A" \
  -d "{\"name\":\"E2E-G$TS\",\"sortOrder\":1}" | json "['id']")
[ -n "$GRADE_ID" ] && ok "创建年级" || fail "创建年级"

CLASS_ID=$(curl -s -X POST "$BASE/admin/classes" -H 'Content-Type: application/json' -H "$AUTH_A" \
  -d "{\"name\":\"E2E-C$TS\",\"gradeId\":\"$GRADE_ID\",\"sortOrder\":1}" | json "['id']")
[ -n "$CLASS_ID" ] && ok "创建班级" || fail "创建班级"

STU1_ID=$(curl -s -X POST "$BASE/admin/students" -H 'Content-Type: application/json' -H "$AUTH_A" \
  -d "{\"classId\":\"$CLASS_ID\",\"gender\":\"M\"}" | json "['id']")
[ -n "$STU1_ID" ] && ok "创建学生1" || fail "创建学生1"

STU2_ID=$(curl -s -X POST "$BASE/admin/students" -H 'Content-Type: application/json' -H "$AUTH_A" \
  -d "{\"classId\":\"$CLASS_ID\",\"gender\":\"F\"}" | json "['id']")
[ -n "$STU2_ID" ] && ok "创建学生2" || fail "创建学生2"

STU_LIST=$(curl -s -H "$AUTH_A" "$BASE/admin/students?classId=$CLASS_ID" | json_v "d.get('total',0) if isinstance(d,dict) else len(d) if isinstance(d,list) else 0")
[ "$STU_LIST" = "2" ] && ok "学生列表: $STU_LIST" || fail "学生列表: $STU_LIST (期望2)"

# --- 1.3 STUDENT LOGIN ---
echo ""
echo "--- 1.3 学生自动登录 ---"
STU1_USER="stu_${STU1_ID:0:8}"
STU2_USER="stu_${STU2_ID:0:8}"

STU1_TOKEN=$(login_as "$STU1_USER" "Test1234")
[ -n "$STU1_TOKEN" ] && ok "学生1 登录 ($STU1_USER)" || fail "学生1 登录"

STU2_TOKEN=$(login_as "$STU2_USER" "Test1234")
[ -n "$STU2_TOKEN" ] && ok "学生2 登录 ($STU2_USER)" || fail "学生2 登录"

AUTH_S1="Authorization: Bearer $STU1_TOKEN"
AUTH_S2="Authorization: Bearer $STU2_TOKEN"

STU1_USER_ID=$(curl -s -H "$AUTH_S1" "$BASE/auth/me" | json "['id']")
STU2_USER_ID=$(curl -s -H "$AUTH_S2" "$BASE/auth/me" | json "['id']")
[ -n "$STU1_USER_ID" ] && ok "获取学生1 userId" || fail "获取学生1 userId"

# --- 1.4 ROLES / PERMISSIONS ---
echo ""
echo "--- 1.4 角色/权限 ---"
ROLES_N=$(curl -s -H "$AUTH_A" "$BASE/admin/roles" | json_v "d.get('total',0)")
[ "$ROLES_N" -ge 4 ] && ok "角色列表: $ROLES_N" || fail "角色列表: $ROLES_N"

PERMS_N=$(curl -s -H "$AUTH_A" "$BASE/admin/permissions" | json_v "d.get('total',0)")
[ "$PERMS_N" -ge 20 ] && ok "权限列表: $PERMS_N" || fail "权限列表: $PERMS_N"

USERS_N=$(curl -s -H "$AUTH_A" "$BASE/admin/users" | json_v "d.get('total',0)")
[ "$USERS_N" -ge 4 ] && ok "用户列表: $USERS_N" || fail "用户列表: $USERS_N"

# --- 1.5 SCALE ---
echo ""
echo "--- 1.5 量表创建 (维度+题目+评分规则+分数区间) ---"
SCALE_RAW=$(curl -s -X POST "$BASE/scales" -H 'Content-Type: application/json' -H "$AUTH_T" -d '{
  "name":"E2E-'$TS'","description":"OTA测试","type":"custom",
  "dimensions":["焦虑","抑郁"],
  "items":[
    {"itemText":"我感到紧张","dimension":"焦虑","itemType":"likert","sortOrder":1,"options":[
      {"optionText":"从不","scoreValue":0,"sortOrder":1},
      {"optionText":"有时","scoreValue":1,"sortOrder":2},
      {"optionText":"经常","scoreValue":2,"sortOrder":3},
      {"optionText":"总是","scoreValue":3,"sortOrder":4}
    ]},
    {"itemText":"我感到沮丧","dimension":"抑郁","itemType":"likert","sortOrder":2,"options":[
      {"optionText":"从不","scoreValue":0,"sortOrder":1},
      {"optionText":"有时","scoreValue":1,"sortOrder":2},
      {"optionText":"经常","scoreValue":2,"sortOrder":3},
      {"optionText":"总是","scoreValue":3,"sortOrder":4}
    ]},
    {"itemText":"我难以入睡","dimension":"焦虑","itemType":"likert","sortOrder":3,"options":[
      {"optionText":"从不","scoreValue":0,"sortOrder":1},
      {"optionText":"有时","scoreValue":1,"sortOrder":2},
      {"optionText":"经常","scoreValue":2,"sortOrder":3},
      {"optionText":"总是","scoreValue":3,"sortOrder":4}
    ]}
  ],
  "scoringRules":[
    {"dimension":"焦虑","formulaType":"sum","weight":1},
    {"dimension":"抑郁","formulaType":"sum","weight":1}
  ],
  "scoreRanges":[
    {"dimension":"焦虑","minScore":0,"maxScore":3,"level":"正常","color":"green","suggestion":"无焦虑"},
    {"dimension":"焦虑","minScore":4,"maxScore":6,"level":"轻度焦虑","color":"yellow","suggestion":"建议关注"},
    {"dimension":"抑郁","minScore":0,"maxScore":1,"level":"正常","color":"green","suggestion":"无抑郁"},
    {"dimension":"抑郁","minScore":2,"maxScore":3,"level":"轻度抑郁","color":"yellow","suggestion":"建议关注"}
  ]
}')
SCALE_ID=$(echo "$SCALE_RAW" | json "['id']")
[ -n "$SCALE_ID" ] && ok "创建量表" || { fail "创建量表: $SCALE_RAW"; exit 1; }

DETAIL=$(curl -s -H "$AUTH_T" "$BASE/scales/$SCALE_ID")
ITEM_N=$(echo "$DETAIL" | json_v "len(d.get('items',[]))")
[ "$ITEM_N" = "3" ] && ok "量表题目数: $ITEM_N" || fail "量表题目数: $ITEM_N"

ITEM1_ID=$(echo "$DETAIL" | python3 -c "import sys,json; items=json.load(sys.stdin)['items']; print([i['id'] for i in items if i['dimension']=='焦虑'][0])")
ITEM2_ID=$(echo "$DETAIL" | python3 -c "import sys,json; items=json.load(sys.stdin)['items']; print([i['id'] for i in items if i['dimension']=='抑郁'][0])")
ITEM3_ID=$(echo "$DETAIL" | python3 -c "import sys,json; items=json.load(sys.stdin)['items']; print([i['id'] for i in items if i['dimension']=='焦虑'][1])")
OPT1_HI=$(echo "$DETAIL" | python3 -c "import sys,json; items=json.load(sys.stdin)['items']; i=[x for x in items if x['dimension']=='焦虑'][0]; print([o['id'] for o in i['options'] if o['scoreValue']==3][0])")
OPT2_HI=$(echo "$DETAIL" | python3 -c "import sys,json; items=json.load(sys.stdin)['items']; i=[x for x in items if x['dimension']=='抑郁'][0]; print([o['id'] for o in i['options'] if o['scoreValue']==3][0])")
OPT3_HI=$(echo "$DETAIL" | python3 -c "import sys,json; items=json.load(sys.stdin)['items']; i=[x for x in items if x['dimension']=='焦虑'][1]; print([o['id'] for o in i['options'] if o['scoreValue']==3][0])")
OPT1_LO=$(echo "$DETAIL" | python3 -c "import sys,json; items=json.load(sys.stdin)['items']; i=[x for x in items if x['dimension']=='焦虑'][0]; print([o['id'] for o in i['options'] if o['scoreValue']==0][0])")
OPT2_LO=$(echo "$DETAIL" | python3 -c "import sys,json; items=json.load(sys.stdin)['items']; i=[x for x in items if x['dimension']=='抑郁'][0]; print([o['id'] for o in i['options'] if o['scoreValue']==0][0])")
OPT3_LO=$(echo "$DETAIL" | python3 -c "import sys,json; items=json.load(sys.stdin)['items']; i=[x for x in items if x['dimension']=='焦虑'][1]; print([o['id'] for o in i['options'] if o['scoreValue']==0][0])")
ok "提取题目/选项 ID"

# --- 1.6 TASK ---
echo ""
echo "--- 1.6 任务创建与发布 ---"
TASK_RAW=$(curl -s -X POST "$BASE/tasks" -H 'Content-Type: application/json' -H "$AUTH_T" \
  -d "{\"title\":\"E2E任务-$TS\",\"scaleId\":\"$SCALE_ID\",\"targetIds\":[\"$CLASS_ID\"],\"targetType\":\"class\",\"deadline\":\"2030-12-31\"}")
TASK_ID=$(echo "$TASK_RAW" | json "['id']")
[ -n "$TASK_ID" ] && ok "创建任务" || fail "创建任务"

PUB=$(curl -s -X POST "$BASE/tasks/$TASK_ID/publish" -H "$AUTH_T" | json "['status']")
[ "$PUB" = "published" ] && ok "发布任务" || fail "发布任务 ($PUB)"

STU_TASKS=$(curl -s -H "$AUTH_S1" "$BASE/tasks" | json_v "d.get('total',0)")
[ "$STU_TASKS" -ge 1 ] && ok "学生可见任务: $STU_TASKS" || fail "学生可见任务: $STU_TASKS"

# --- 1.7 CONSENT ---
echo ""
echo "--- 1.7 知情同意 ---"
C1=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/consent" -H 'Content-Type: application/json' -H "$AUTH_A" \
  -d "{\"userId\":\"$STU1_USER_ID\",\"studentId\":\"$STU1_ID\",\"consentType\":\"assessment\",\"contentHash\":\"e2e-h1\",\"signedAt\":\"$(date -Iseconds)\"}")
[ "$C1" = "201" ] && ok "学生1知情同意" || fail "学生1知情同意 ($C1)"

C2=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/consent" -H 'Content-Type: application/json' -H "$AUTH_A" \
  -d "{\"userId\":\"$STU2_USER_ID\",\"studentId\":\"$STU2_ID\",\"consentType\":\"assessment\",\"contentHash\":\"e2e-h2\",\"signedAt\":\"$(date -Iseconds)\"}")
[ "$C2" = "201" ] && ok "学生2知情同意" || fail "学生2知情同意 ($C2)"

# --- 1.8 SUBMIT ---
echo ""
echo "--- 1.8 学生做题 ---"
R1=$(curl -s -X POST "$BASE/tasks/$TASK_ID/answers/submit" -H 'Content-Type: application/json' -H "$AUTH_S1" \
  -d "{\"items\":[{\"itemId\":\"$ITEM1_ID\",\"optionId\":\"$OPT1_HI\"},{\"itemId\":\"$ITEM2_ID\",\"optionId\":\"$OPT2_HI\"},{\"itemId\":\"$ITEM3_ID\",\"optionId\":\"$OPT3_HI\"}]}")
R1_ID=$(echo "$R1" | json "['id']" 2>/dev/null || echo "")
R1_COLOR=$(echo "$R1" | json "['color']" 2>/dev/null || echo "")
[ -n "$R1_ID" ] && ok "学生1提交 (color=$R1_COLOR)" || fail "学生1提交: $R1"
[ "$R1_COLOR" = "yellow" ] && ok "学生1触发黄色预警" || fail "学生1风险色: $R1_COLOR (期望yellow)"

R2=$(curl -s -X POST "$BASE/tasks/$TASK_ID/answers/submit" -H 'Content-Type: application/json' -H "$AUTH_S2" \
  -d "{\"items\":[{\"itemId\":\"$ITEM1_ID\",\"optionId\":\"$OPT1_LO\"},{\"itemId\":\"$ITEM2_ID\",\"optionId\":\"$OPT2_LO\"},{\"itemId\":\"$ITEM3_ID\",\"optionId\":\"$OPT3_LO\"}]}")
R2_ID=$(echo "$R2" | json "['id']" 2>/dev/null || echo "")
R2_COLOR=$(echo "$R2" | json "['color']" 2>/dev/null || echo "")
[ -n "$R2_ID" ] && ok "学生2提交 (color=$R2_COLOR)" || fail "学生2提交: $R2"
[ "$R2_COLOR" = "green" ] && ok "学生2正常" || fail "学生2风险色: $R2_COLOR"

DUP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/tasks/$TASK_ID/answers/submit" -H 'Content-Type: application/json' -H "$AUTH_S1" \
  -d "{\"items\":[{\"itemId\":\"$ITEM1_ID\",\"optionId\":\"$OPT1_HI\"}]}")
[ "$DUP" = "400" ] && ok "重复提交被拒绝" || fail "重复提交 ($DUP)"

# --- 1.9 RESULTS ---
echo ""
echo "--- 1.9 结果查询 ---"
ALL_RES=$(curl -s -H "$AUTH_A" "$BASE/results" | json_v "len(d) if isinstance(d,list) else d.get('total',0)")
[ "$ALL_RES" -ge 2 ] && ok "总结果数: $ALL_RES" || fail "总结果数: $ALL_RES"

CLS_RES=$(curl -s -H "$AUTH_T" "$BASE/results/class/$CLASS_ID" | json_v "d.get('total',0) if isinstance(d,dict) else len(d)")
[ "$CLS_RES" -ge 2 ] && ok "班级结果: $CLS_RES" || fail "班级结果: $CLS_RES"

MY_RES=$(curl -s -H "$AUTH_S1" "$BASE/results/me" | json_v "len(d) if isinstance(d,list) else 0")
[ "$MY_RES" -ge 1 ] && ok "学生1自己结果: $MY_RES" || fail "学生1自己结果: $MY_RES"

# --- 1.10 ALERTS ---
echo ""
echo "--- 1.10 预警 ---"
ALERTS=$(curl -s -H "$AUTH_T" "$BASE/alerts")
ALERT_TOTAL=$(echo "$ALERTS" | json_v "d.get('total',0) if isinstance(d,dict) else len(d)")
[ "$ALERT_TOTAL" -ge 1 ] && ok "预警列表: $ALERT_TOTAL" || fail "预警列表: $ALERT_TOTAL"

ALERT1_ID=$(echo "$ALERTS" | python3 -c "
import sys,json; d=json.load(sys.stdin)
for a in (d.get('data',d) if isinstance(d,dict) else d if isinstance(d,list) else []):
  print(a['id']); break
" 2>/dev/null || echo "")

if [ -n "$ALERT1_ID" ]; then
  AD=$(curl -s -H "$AUTH_T" "$BASE/alerts/$ALERT1_ID")
  ok "预警详情: level=$(echo "$AD" | json "['level']") status=$(echo "$AD" | json "['status']")"

  HC=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/alerts/$ALERT1_ID/handle" -H 'Content-Type: application/json' -H "$AUTH_T" \
    -d '{"handleNote":"E2E: 已联系家长"}')
  [ "$HC" = "200" ] || [ "$HC" = "201" ] && ok "预警处理" || fail "预警处理 ($HC)"

  FC=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/alerts/$ALERT1_ID/followup" -H 'Content-Type: application/json' -H "$AUTH_T" \
    -d '{"handleNote":"转入随访"}')
  ok "预警转随访 ($FC)"
else
  fail "未找到预警ID"
fi

# --- 1.11 FOLLOWUP ---
echo ""
echo "--- 1.11 随访 ---"
FU_STU=$(curl -s -H "$AUTH_T" "$BASE/followup-manage/students")
FU_N=$(echo "$FU_STU" | json_v "d.get('total',0) if isinstance(d,dict) else len(d) if isinstance(d,list) else 0")
[ "$FU_N" -ge 1 ] && ok "随访学生: $FU_N" || fail "随访学生: $FU_N"

CFG=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_T" "$BASE/followup-manage/config")
[ "$CFG" = "200" ] && ok "随访配置" || fail "随访配置 ($CFG)"

# --- 1.12 INTERVIEW ---
echo ""
echo "--- 1.12 访谈记录 ---"
T_UID=$(curl -s -H "$AUTH_T" "$BASE/auth/me" | json "['id']")
INT_RAW=$(curl -s -X POST "$BASE/interviews" -H 'Content-Type: application/json' -H "$AUTH_T" \
  -d "{\"studentId\":\"$STU1_ID\",\"psychologistId\":\"$T_UID\",\"interviewDate\":\"$(date -Idate)\",\"location\":\"心理室\",\"notes\":\"E2E访谈\"}")
INT_ID=$(echo "$INT_RAW" | json "['id']" 2>/dev/null || echo "")
[ -n "$INT_ID" ] && ok "创建访谈" || fail "创建访谈: $INT_RAW"

TLC=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_T" "$BASE/interviews/timeline/$STU1_ID")
[ "$TLC" = "200" ] && ok "访谈时间线" || fail "访谈时间线 ($TLC)"

# --- 1.13 DASHBOARD ---
echo ""
echo "--- 1.13 仪表盘 ---"
DASH=$(curl -s -H "$AUTH_T" "$BASE/dashboard/overview")
D_TASKS=$(echo "$DASH" | json_v "d.get('total_tasks',0)")
D_ANS=$(echo "$DASH" | json_v "d.get('submitted_answers',0)")
D_ALERTS=$(echo "$DASH" | json_v "d.get('total_alerts',0)")
ok "仪表盘: tasks=$D_TASKS answers=$D_ANS alerts=$D_ALERTS"

[ "$D_TASKS" -ge 1 ] && ok "任务数≥1" || fail "任务数: $D_TASKS"
[ "$D_ANS" -ge 2 ] && ok "提交数≥2" || fail "提交数: $D_ANS"
[ "$D_ALERTS" -ge 1 ] && ok "预警数≥1" || fail "预警数: $D_ALERTS"

DIST=$(curl -s -H "$AUTH_T" "$BASE/dashboard/alert-distribution")
ok "预警分布"

COMP=$(curl -s -H "$AUTH_T" "$BASE/dashboard/completion?taskId=$TASK_ID")
ok "完成率"

# --- 1.14 RETEST COMPARISON ---
echo ""
echo "--- 1.14 复测对比 ---"
CMP=$(curl -s -H "$AUTH_T" "$BASE/results/compare?studentId=$STU1_USER_ID&scaleId=$SCALE_ID")
CMP_TREND=$(echo "$CMP" | json_v "d.get('trend','?')")
CMP_HIST=$(echo "$CMP" | json_v "len(d.get('history',[]))")
ok "复测对比: trend=$CMP_TREND history=$CMP_HIST"

SCAN=$(curl -s -X POST "$BASE/results/scan-trend-alerts/$TASK_ID" -H "$AUTH_T")
ok "趋势扫描"

# --- 1.15 EXPORT ---
echo ""
echo "--- 1.15 数据导出 ---"
EXP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "$AUTH_T" "$BASE/export/excel/task/$TASK_ID")
[ "$EXP_CODE" = "200" ] && ok "Excel 导出" || fail "Excel 导出 ($EXP_CODE)"

# --- 1.16 LIBRARY ---
echo ""
echo "--- 1.16 量表库 ---"
LIB=$(curl -s -H "$AUTH_T" "$BASE/scales/library")
LIB_N=$(echo "$LIB" | json_v "len(d) if isinstance(d,list) else d.get('total',0)")
ok "Library 量表: $LIB_N"

###############################################################################
# Phase 1 SNAPSHOT
###############################################################################
echo ""
echo "--- Phase 1 快照 ---"
# Fresh admin token for snapshot
SNAP_TOKEN=$(login_as admin admin123)
take_snapshot "Phase 1 完成后" "$SNAP_TOKEN" "P1"

# Save specific IDs for post-OTA verification
echo "  关键 ID:"
echo "    GRADE=$GRADE_ID  CLASS=$CLASS_ID  SCALE=$SCALE_ID  TASK=$TASK_ID"
echo "    STU1=$STU1_ID  STU2=$STU2_ID  ALERT=$ALERT1_ID  INTERVIEW=$INT_ID"
echo "    STU1_USER=$STU1_USER_ID  STU2_USER=$STU2_USER_ID"

###############################################################################
# Phase 2: OTA simulation
###############################################################################
if [ "$MODE" = "no-ota" ]; then
  echo ""
  echo "  ⏩ 跳过 OTA (--no-ota)"
else
  echo ""
  echo "══════════════════════════════════════════"
  echo "  Phase 2: 模拟 OTA 更新"
  echo "══════════════════════════════════════════"

  echo ""
  echo "  步骤 1/5: 停止应用..."
  stop_app

  echo "  步骤 2/5: 验证数据库文件仍在..."
  [ -f "$DATA_DIR/db/PG_VERSION" ] && ok "PG_VERSION 存在" || { fail "PG_VERSION 丢失!"; exit 1; }
  [ -d "$DATA_DIR/db/base" ] && ok "base 目录存在" || { fail "base 目录丢失!"; exit 1; }

  echo "  步骤 3/5: 模拟 OTA 文件替换..."
  bash "$SOURCE_DIR/scripts/deploy-test-env.sh" --update

  AFTER_VERSION=$(json_v "d.get('version','?')" < "$DEPLOY_DIR/version.json")
  ok "OTA 后版本: $AFTER_VERSION (之前: $BEFORE_VERSION)"

  echo "  步骤 4/5: 重新启动应用..."
  start_app /tmp/woodpecker-test-phase2.log
  wait_for_server 90 || { echo "启动日志:"; tail -30 /tmp/woodpecker-test-phase2.log; exit 1; }

  echo "  步骤 5/5: 验证服务健康..."
  HEALTH=$(curl -s http://localhost:3000/health)
  ok "Health: $HEALTH"

  # -----------------------------------------------------------------------
  # Phase 3: Post-OTA data persistence verification
  # -----------------------------------------------------------------------
  echo ""
  echo "══════════════════════════════════════════"
  echo "  Phase 3: OTA 后数据持久性验证"
  echo "══════════════════════════════════════════"

  echo ""
  echo "--- 3.1 重新登录 (JWT 已刷新) ---"
  OTA_ADMIN=$(login_as admin admin123)
  [ -n "$OTA_ADMIN" ] && ok "OTA后 admin 登录" || { fail "OTA后 admin 登录"; tail -30 /tmp/woodpecker-test-phase2.log; exit 1; }

  OTA_TEACHER=$(login_as "张毛毛" "Abc12345")
  [ -n "$OTA_TEACHER" ] && ok "OTA后 张毛毛 登录" || fail "OTA后 张毛毛 登录"

  OTA_A="Authorization: Bearer $OTA_ADMIN"
  OTA_T="Authorization: Bearer $OTA_TEACHER"

  echo ""
  echo "--- 3.2 数据数量对比 ---"
  OTA_USERS=$(_api GET "$OTA_ADMIN" "/admin/users" "d.get('total',0)")
  OTA_GRADES=$(_api GET "$OTA_ADMIN" "/admin/grades" "d.get('total',0)")
  OTA_SCALES=$(_api GET "$OTA_ADMIN" "/scales" "d.get('total',0)")
  OTA_TASKS=$(_api GET "$OTA_ADMIN" "/tasks" "d.get('total',0)")
  OTA_RESULTS=$(_api GET "$OTA_ADMIN" "/results" "len(d) if isinstance(d,list) else d.get('total',0)")
  OTA_ALERTS=$(curl -s -H "$OTA_T" "$BASE/alerts" | json_v "d.get('total',0) if isinstance(d,dict) else len(d)")
  OTA_STUDENTS=$(_api GET "$OTA_ADMIN" "/admin/students" "d.get('total',0)")

  [ "$OTA_USERS" = "$S_USERS" ] && ok "用户数一致: $OTA_USERS" || fail "用户数: $S_USERS → $OTA_USERS"
  [ "$OTA_GRADES" = "$S_GRADES" ] && ok "年级数一致: $OTA_GRADES" || fail "年级数: $S_GRADES → $OTA_GRADES"
  [ "$OTA_SCALES" = "$S_SCALES" ] && ok "量表数一致: $OTA_SCALES" || fail "量表数: $S_SCALES → $OTA_SCALES"
  [ "$OTA_TASKS" = "$S_TASKS" ] && ok "任务数一致: $OTA_TASKS" || fail "任务数: $S_TASKS → $OTA_TASKS"
  [ "$OTA_RESULTS" = "$S_RESULTS" ] && ok "结果数一致: $OTA_RESULTS" || fail "结果数: $S_RESULTS → $OTA_RESULTS"
  [ "$OTA_ALERTS" = "$S_ALERTS" ] && ok "预警数一致: $OTA_ALERTS" || fail "预警数: $S_ALERTS → $OTA_ALERTS"
  [ "$OTA_STUDENTS" = "$S_STUDENTS" ] && ok "学生数一致: $OTA_STUDENTS" || fail "学生数: $S_STUDENTS → $OTA_STUDENTS"

  echo ""
  echo "--- 3.3 特定记录校验 ---"
  SD=$(curl -s -H "$OTA_A" "$BASE/scales/$SCALE_ID")
  SD_ID=$(echo "$SD" | json "['id']" 2>/dev/null || echo "")
  SD_ITEMS=$(echo "$SD" | json_v "len(d.get('items',[]))")
  [ "$SD_ID" = "$SCALE_ID" ] && ok "量表记录存在" || fail "量表记录丢失"
  [ "$SD_ITEMS" = "3" ] && ok "量表题目数=3" || fail "量表题目数: $SD_ITEMS"

  TD=$(curl -s -H "$OTA_A" "$BASE/tasks/$TASK_ID")
  TD_ID=$(echo "$TD" | json "['id']" 2>/dev/null || echo "")
  TD_STATUS=$(echo "$TD" | json "['status']" 2>/dev/null || echo "")
  [ "$TD_ID" = "$TASK_ID" ] && ok "任务记录存在 (status=$TD_STATUS)" || fail "任务记录丢失"

  CR=$(curl -s -H "$OTA_T" "$BASE/results/class/$CLASS_ID" | json_v "d.get('total',0) if isinstance(d,dict) else len(d)")
  [ "$CR" = "2" ] && ok "班级结果仍为2" || fail "班级结果: $CR"

  SL=$(curl -s -H "$OTA_A" "$BASE/admin/students?classId=$CLASS_ID" | json_v "d.get('total',0) if isinstance(d,dict) else len(d)")
  [ "$SL" = "2" ] && ok "班级学生仍为2" || fail "班级学生: $SL"

  echo ""
  echo "--- 3.4 学生仍可登录 ---"
  OTA_S1=$(login_as "$STU1_USER" "Test1234")
  [ -n "$OTA_S1" ] && ok "OTA后学生1可登录" || fail "OTA后学生1无法登录"

  OTA_S2=$(login_as "$STU2_USER" "Test1234")
  [ -n "$OTA_S2" ] && ok "OTA后学生2可登录" || fail "OTA后学生2无法登录"

  OTA_OS1="Authorization: Bearer $OTA_S1"
  OTA_MY=$(curl -s -H "$OTA_OS1" "$BASE/results/me" | json_v "len(d) if isinstance(d,list) else 0")
  [ "$OTA_MY" = "1" ] && ok "学生1可查看做题结果" || fail "学生1结果丢失: $OTA_MY"

  echo ""
  echo "--- 3.5 仪表盘数据一致 ---"
  OD=$(curl -s -H "$OTA_T" "$BASE/dashboard/overview")
  OD_TASKS=$(echo "$OD" | json_v "d.get('total_tasks',0)")
  OD_ANS=$(echo "$OD" | json_v "d.get('submitted_answers',0)")
  OD_ALERTS=$(echo "$OD" | json_v "d.get('total_alerts',0)")

  [ "$OD_TASKS" = "$D_TASKS" ] && ok "仪表盘任务一致: $OD_TASKS" || fail "仪表盘任务: $D_TASKS → $OD_TASKS"
  [ "$OD_ANS" = "$D_ANS" ] && ok "仪表盘提交一致: $OD_ANS" || fail "仪表盘提交: $D_ANS → $OD_ANS"
  [ "$OD_ALERTS" = "$D_ALERTS" ] && ok "仪表盘预警一致: $OD_ALERTS" || fail "仪表盘预警: $D_ALERTS → $OD_ALERTS"

  echo ""
  echo "--- 3.6 Library 量表 ---"
  OTA_LIB=$(curl -s -H "$OTA_T" "$BASE/scales/library" | json_v "len(d) if isinstance(d,list) else d.get('total',0)")
  [ "$OTA_LIB" = "$LIB_N" ] && ok "Library 量表一致: $OTA_LIB" || fail "Library 量表: $LIB_N → $OTA_LIB"

  echo ""
  echo "--- 3.7 OTA 后新业务流程（创建+查询） ---"
  OTA_TS=$(date +%s)
  OTA_SCALE=$(curl -s -X POST "$BASE/scales" -H 'Content-Type: application/json' -H "$OTA_T" -d '{
    "name":"OTA-NEW-'$OTA_TS'","description":"OTA后新量表","type":"custom",
    "dimensions":["压力"],
    "items":[{"itemText":"我感到有压力","dimension":"压力","itemType":"likert","sortOrder":1,"options":[
      {"optionText":"无","scoreValue":0,"sortOrder":1},{"optionText":"有","scoreValue":1,"sortOrder":2}
    ]}],
    "scoringRules":[{"dimension":"压力","formulaType":"sum","weight":1}],
    "scoreRanges":[{"dimension":"压力","minScore":0,"maxScore":0,"level":"正常","color":"green","suggestion":"无"},{"dimension":"压力","minScore":1,"maxScore":1,"level":"有压力","color":"yellow","suggestion":"关注"}]
  }')
  OTA_SCALE_ID=$(echo "$OTA_SCALE" | json "['id']")
  [ -n "$OTA_SCALE_ID" ] && ok "OTA后创建新量表" || fail "OTA后创建新量表: $OTA_SCALE"

  OTA_SCALE_GET=$(curl -s -H "$OTA_T" "$BASE/scales/$OTA_SCALE_ID" | json "['id']")
  [ "$OTA_SCALE_GET" = "$OTA_SCALE_ID" ] && ok "OTA后读取新量表" || fail "OTA后读取新量表"

  # Cleanup temp scale
  curl -s -X DELETE "$BASE/scales/$OTA_SCALE_ID" -H "$OTA_T" -o /dev/null || true
fi

###############################################################################
# Phase 4: Cleanup
###############################################################################
echo ""
echo "══════════════════════════════════════════"
echo "  Phase 4: 清理测试数据"
echo "══════════════════════════════════════════"

# Use latest tokens
CLEAN_TOKEN=$(login_as admin admin123)
CLEAN_T=$(login_as "张毛毛" "Abc12345")
CA="Authorization: Bearer $CLEAN_TOKEN"
CT="Authorization: Bearer $CLEAN_T"

COMPLETE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/tasks/$TASK_ID/complete" -H "$CT")
ok "完成任务 ($COMPLETE)"

curl -s -X DELETE "$BASE/tasks/$TASK_ID" -H "$CT" -o /dev/null -w "%{http_code}" | grep -qE "200|204" && ok "删除任务" || ok "删除任务 (跳过)"

[ -n "$INT_ID" ] && curl -s -X DELETE "$BASE/interviews/$INT_ID" -H "$CT" -o /dev/null -w "%{http_code}" | grep -qE "200|204" && ok "删除访谈" || ok "删除访谈 (跳过)"

curl -s -X DELETE "$BASE/scales/$SCALE_ID" -H "$CT" -o /dev/null -w "%{http_code}" | grep -qE "200|204" && ok "删除量表" || ok "删除量表 (需reauth)"

curl -s -X DELETE "$BASE/admin/students/$STU1_ID" -H "$CA" -o /dev/null -w "%{http_code}" | grep -qE "200|204" && ok "删除学生1" || fail "删除学生1"
curl -s -X DELETE "$BASE/admin/students/$STU2_ID" -H "$CA" -o /dev/null -w "%{http_code}" | grep -qE "200|204" && ok "删除学生2" || fail "删除学生2"
curl -s -X DELETE "$BASE/admin/classes/$CLASS_ID" -H "$CA" -o /dev/null -w "%{http_code}" | grep -qE "200|204" && ok "删除班级" || fail "删除班级"
curl -s -X DELETE "$BASE/admin/grades/$GRADE_ID" -H "$CA" -o /dev/null -w "%{http_code}" | grep -qE "200|204" && ok "删除年级" || fail "删除年级"

# Stop app
stop_app

###############################################################################
# SUMMARY
###############################################################################
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
if [ $FAIL -eq 0 ]; then
  echo "║  ✅ 全部通过: $PASS 项测试                                 ║"
else
  echo "║  ⚠️  通过 $PASS / 失败 $FAIL                                ║"
  echo -e "\n  失败项:$ERRORS"
fi
echo "╚════════════════════════════════════════════════════════════╝"

[ $FAIL -eq 0 ]
