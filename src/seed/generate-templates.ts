import * as ExcelJS from 'exceljs';
import * as path from 'path';

const TEMPLATES_DIR = path.resolve(__dirname, 'templates');

interface ScaleTemplate {
  filename: string;
  name: string;
  description: string;
  items: {
    text: string;
    dimension?: string;
    options: { text: string; score: number }[];
  }[];
  scoringRules: { dimension: string; formulaType: string }[];
  scoreRanges: {
    dimension: string;
    min: number;
    max: number;
    level: string;
    color: string;
    suggestion: string;
  }[];
}

const SDS_ITEMS: ScaleTemplate = {
  filename: 'SDS.xlsx',
  name: '抑郁自评量表 (SDS)',
  description: 'Zung Self-Rating Depression Scale，用于评估抑郁状态的严重程度',
  items: [
    {
      text: '我觉得闷闷不乐，情绪低沉',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我觉得一天中早晨最好',
      options: [
        { text: '没有或很少时间', score: 4 },
        { text: '少部分时间', score: 3 },
        { text: '相当多时间', score: 2 },
        { text: '绝大部分或全部时间', score: 1 },
      ],
    },
    {
      text: '我一阵阵地哭出来或想哭',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我晚上睡眠不好',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我吃的跟平常一样多',
      options: [
        { text: '没有或很少时间', score: 4 },
        { text: '少部分时间', score: 3 },
        { text: '相当多时间', score: 2 },
        { text: '绝大部分或全部时间', score: 1 },
      ],
    },
    {
      text: '我觉得做任何事情都没有意思',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我觉得将来没有什么希望',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我觉得比平常容易紧张和着急',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我觉得生活过得很有意思',
      options: [
        { text: '没有或很少时间', score: 4 },
        { text: '少部分时间', score: 3 },
        { text: '相当多时间', score: 2 },
        { text: '绝大部分或全部时间', score: 1 },
      ],
    },
    {
      text: '我对异性的兴趣比以前降低',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我觉得我对做事缺乏干劲',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我觉得我精力下降，活动减慢',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我觉得自己对未来是有希望的',
      options: [
        { text: '没有或很少时间', score: 4 },
        { text: '少部分时间', score: 3 },
        { text: '相当多时间', score: 2 },
        { text: '绝大部分或全部时间', score: 1 },
      ],
    },
    {
      text: '我觉得自己很幸运',
      options: [
        { text: '没有或很少时间', score: 4 },
        { text: '少部分时间', score: 3 },
        { text: '相当多时间', score: 2 },
        { text: '绝大部分或全部时间', score: 1 },
      ],
    },
    {
      text: '我觉得我容易哭泣',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我觉得我做事和别人一样好',
      options: [
        { text: '没有或很少时间', score: 4 },
        { text: '少部分时间', score: 3 },
        { text: '相当多时间', score: 2 },
        { text: '绝大部分或全部时间', score: 1 },
      ],
    },
    {
      text: '我觉得自己是个有用的人',
      options: [
        { text: '没有或很少时间', score: 4 },
        { text: '少部分时间', score: 3 },
        { text: '相当多时间', score: 2 },
        { text: '绝大部分或全部时间', score: 1 },
      ],
    },
    {
      text: '我的生活很有意义',
      options: [
        { text: '没有或很少时间', score: 4 },
        { text: '少部分时间', score: 3 },
        { text: '相当多时间', score: 2 },
        { text: '绝大部分或全部时间', score: 1 },
      ],
    },
    {
      text: '假如我死了别人会过得更好',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '平常感兴趣的事我现在仍然感兴趣',
      options: [
        { text: '没有或很少时间', score: 4 },
        { text: '少部分时间', score: 3 },
        { text: '相当多时间', score: 2 },
        { text: '绝大部分或全部时间', score: 1 },
      ],
    },
  ],
  scoringRules: [{ dimension: '', formulaType: 'sum' }],
  scoreRanges: [
    {
      dimension: '',
      min: 20,
      max: 40,
      level: '正常',
      color: 'green',
      suggestion: '心理状态良好，请继续保持积极心态',
    },
    {
      dimension: '',
      min: 41,
      max: 47,
      level: '轻度抑郁',
      color: 'yellow',
      suggestion: '建议关注心理健康，适当调整作息，必要时寻求帮助',
    },
    {
      dimension: '',
      min: 48,
      max: 55,
      level: '中度抑郁',
      color: 'yellow',
      suggestion: '建议到心理咨询中心进行进一步评估',
    },
    {
      dimension: '',
      min: 56,
      max: 80,
      level: '重度抑郁',
      color: 'red',
      suggestion: '强烈建议尽快到专业机构进行心理咨询或治疗',
    },
  ],
};

const SAS_ITEMS: ScaleTemplate = {
  filename: 'SAS.xlsx',
  name: '焦虑自评量表 (SAS)',
  description: 'Zung Self-Rating Anxiety Scale，用于评估焦虑状态的严重程度',
  items: [
    {
      text: '我觉得比平常容易紧张和着急',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我无缘无故地感到害怕',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我容易心里烦乱或觉得惊恐',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我觉得我可能将要发疯',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我觉得一切都很好，也不会发生什么不幸',
      options: [
        { text: '没有或很少时间', score: 4 },
        { text: '少部分时间', score: 3 },
        { text: '相当多时间', score: 2 },
        { text: '绝大部分或全部时间', score: 1 },
      ],
    },
    {
      text: '我手脚发抖打颤',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我因为头痛、颈痛和背痛而苦恼',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我感觉容易衰弱和疲乏',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我觉得心平气和，并且容易安静坐着',
      options: [
        { text: '没有或很少时间', score: 4 },
        { text: '少部分时间', score: 3 },
        { text: '相当多时间', score: 2 },
        { text: '绝大部分或全部时间', score: 1 },
      ],
    },
    {
      text: '我觉得心跳得很快',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我因为一阵阵头晕而苦恼',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我有晕倒发作，或觉得要晕倒似的',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我吸气呼气都感到很容易',
      options: [
        { text: '没有或很少时间', score: 4 },
        { text: '少部分时间', score: 3 },
        { text: '相当多时间', score: 2 },
        { text: '绝大部分或全部时间', score: 1 },
      ],
    },
    {
      text: '我的手脚麻木和刺痛',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我因为胃痛和消化不良而苦恼',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我常常要小便',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我的手常常是干燥温暖的',
      options: [
        { text: '没有或很少时间', score: 4 },
        { text: '少部分时间', score: 3 },
        { text: '相当多时间', score: 2 },
        { text: '绝大部分或全部时间', score: 1 },
      ],
    },
    {
      text: '我脸红发热',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
    {
      text: '我容易入睡并且一夜睡得很好',
      options: [
        { text: '没有或很少时间', score: 4 },
        { text: '少部分时间', score: 3 },
        { text: '相当多时间', score: 2 },
        { text: '绝大部分或全部时间', score: 1 },
      ],
    },
    {
      text: '我做噩梦',
      options: [
        { text: '没有或很少时间', score: 1 },
        { text: '少部分时间', score: 2 },
        { text: '相当多时间', score: 3 },
        { text: '绝大部分或全部时间', score: 4 },
      ],
    },
  ],
  scoringRules: [{ dimension: '', formulaType: 'sum' }],
  scoreRanges: [
    {
      dimension: '',
      min: 20,
      max: 40,
      level: '正常',
      color: 'green',
      suggestion: '焦虑水平正常，请继续保持良好心态',
    },
    {
      dimension: '',
      min: 41,
      max: 47,
      level: '轻度焦虑',
      color: 'yellow',
      suggestion: '存在轻度焦虑，建议适当放松，规律运动',
    },
    {
      dimension: '',
      min: 48,
      max: 55,
      level: '中度焦虑',
      color: 'yellow',
      suggestion: '建议到心理咨询中心进行进一步评估',
    },
    {
      dimension: '',
      min: 56,
      max: 80,
      level: '重度焦虑',
      color: 'red',
      suggestion: '强烈建议尽快到专业机构进行心理咨询或治疗',
    },
  ],
};

const MHT_ITEMS: ScaleTemplate = {
  filename: 'MHT.xlsx',
  name: '心理健康测试 (MHT)',
  description: 'Mental Health Test，用于评估中学生的心理健康状况，包含8个维度',
  items: [
    // 学习焦虑 (items 1-15)
    {
      text: '临近考试时我会感到非常紧张',
      dimension: '学习焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '考试成绩公布前我总是心神不定',
      dimension: '学习焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我担心自己的学习成绩会让父母失望',
      dimension: '学习焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '上课时我常担心老师提问自己',
      dimension: '学习焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '作业做不出来时我会很焦虑',
      dimension: '学习焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我害怕考试不及格',
      dimension: '学习焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '考试前我经常睡不好觉',
      dimension: '学习焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我觉得学习压力很大让我喘不过气',
      dimension: '学习焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '看到考试成绩排名我会紧张不安',
      dimension: '学习焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我担心自己跟不上班级的学习进度',
      dimension: '学习焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '上课回答问题时我会紧张得说不出话',
      dimension: '学习焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '考试时我常常因为紧张而出错',
      dimension: '学习焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我害怕老师在课堂上批评我',
      dimension: '学习焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '一想到考试我就吃不下饭',
      dimension: '学习焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我经常担心作业做得不够好',
      dimension: '学习焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    // 对人焦虑 (items 16-25)
    {
      text: '在陌生人面前我感到很不自在',
      dimension: '对人焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我害怕与不认识的人说话',
      dimension: '对人焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '和同学说话时我容易脸红',
      dimension: '对人焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我不敢主动与同学交朋友',
      dimension: '对人焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '在很多人面前讲话我会非常紧张',
      dimension: '对人焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我担心别人觉得我不好相处',
      dimension: '对人焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '被老师提问时我害怕在全班同学面前回答',
      dimension: '对人焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我不太愿意参加集体活动',
      dimension: '对人焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我觉得很难融入同学之中',
      dimension: '对人焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我害怕在公共场合被别人注视',
      dimension: '对人焦虑',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    // 孤独倾向 (items 26-35)
    {
      text: '我常常觉得自己是孤独的',
      dimension: '孤独倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '在学校里我没有可以倾诉心事的朋友',
      dimension: '孤独倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '课间休息时我常常一个人待着',
      dimension: '孤独倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我觉得没有人真正理解我',
      dimension: '孤独倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '放学后我很少和同学一起活动',
      dimension: '孤独倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我觉得在班级里自己是个局外人',
      dimension: '孤独倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我经常感到被同学冷落',
      dimension: '孤独倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我希望自己能有更多的朋友',
      dimension: '孤独倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '遇到烦心事时我不知道该和谁说',
      dimension: '孤独倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我觉得不管在哪里自己都是一个人',
      dimension: '孤独倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    // 自责倾向 (items 36-45)
    {
      text: '考试没考好时我觉得都是自己的错',
      dimension: '自责倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我常常觉得自己做得不够好',
      dimension: '自责倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '和同学发生矛盾时我总觉得是自己的问题',
      dimension: '自责倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我对自己要求非常严格',
      dimension: '自责倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '犯错后我会反复责备自己很久',
      dimension: '自责倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '别人成绩比我好我觉得是自己不够努力',
      dimension: '自责倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我经常对自己的表现感到不满意',
      dimension: '自责倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '事情做不好时我会觉得自己很没用',
      dimension: '自责倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我总觉得如果自己再努力一些就好了',
      dimension: '自责倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '被老师批评后我会一直责怪自己',
      dimension: '自责倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    // 过敏倾向 (items 46-55)
    {
      text: '别人说话时我总觉得是在议论我',
      dimension: '过敏倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '同学笑的时候我担心他们是在嘲笑我',
      dimension: '过敏倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '别人的一个眼神就能让我不舒服',
      dimension: '过敏倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我很容易因为别人的话而难过',
      dimension: '过敏倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我对别人的评价非常在意',
      dimension: '过敏倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我很容易感到委屈',
      dimension: '过敏倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '别人不理我时我会想是不是自己做错了什么',
      dimension: '过敏倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我经常猜测别人对我的看法',
      dimension: '过敏倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我对周围环境的变化很敏感',
      dimension: '过敏倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '别人一句无心的话会让我纠结很久',
      dimension: '过敏倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    // 身体症状 (items 56-70)
    {
      text: '我经常感到头痛',
      dimension: '身体症状',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我常常觉得肚子不舒服',
      dimension: '身体症状',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我有时会感到胸闷气短',
      dimension: '身体症状',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我经常觉得疲劳无力',
      dimension: '身体症状',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '考试前我容易拉肚子',
      dimension: '身体症状',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我有时会感到头晕目眩',
      dimension: '身体症状',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '紧张时我觉得心跳得很快',
      dimension: '身体症状',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我经常睡不好觉',
      dimension: '身体症状',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我有时会觉得呼吸不畅',
      dimension: '身体症状',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我经常感到全身酸痛',
      dimension: '身体症状',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '早上起床时我觉得浑身不舒服',
      dimension: '身体症状',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我常常没有胃口吃不下东西',
      dimension: '身体症状',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '紧张时我手脚发凉出汗',
      dimension: '身体症状',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我有时感到恶心想吐',
      dimension: '身体症状',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我经常觉得眼睛很疲劳',
      dimension: '身体症状',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    // 恐怖倾向 (items 71-80)
    {
      text: '我害怕蛇或虫子等动物',
      dimension: '恐怖倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我很害怕黑暗',
      dimension: '恐怖倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '看到血我会感到害怕',
      dimension: '恐怖倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我害怕站在高处',
      dimension: '恐怖倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我害怕打雷闪电',
      dimension: '恐怖倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我不愿意去医院',
      dimension: '恐怖倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我害怕密集排列的东西',
      dimension: '恐怖倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我害怕乘坐电梯',
      dimension: '恐怖倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我害怕待在封闭的空间里',
      dimension: '恐怖倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我害怕自己会生重病',
      dimension: '恐怖倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    // 冲动倾向 (items 81-100)
    {
      text: '我经常控制不住自己的脾气',
      dimension: '冲动倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '生气时我会摔东西发泄',
      dimension: '冲动倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '别人说了我不爱听的话我会立刻反驳',
      dimension: '冲动倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我做事常常不顾后果',
      dimension: '冲动倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我容易和别人发生冲突',
      dimension: '冲动倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '和父母吵架时我会说出伤人的话',
      dimension: '冲动倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我有时会突然想做危险的事情',
      dimension: '冲动倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '被同学欺负时我想用暴力来解决',
      dimension: '冲动倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我做事很冲动事后又后悔',
      dimension: '冲动倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我很难耐心地排队等待',
      dimension: '冲动倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '别人打断我说话时我会非常生气',
      dimension: '冲动倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我有时会突然想离开学校',
      dimension: '冲动倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '心情不好时我会做出一些出格的事',
      dimension: '冲动倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我容易因为小事大发雷霆',
      dimension: '冲动倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '和同学意见不合时我会大声争吵',
      dimension: '冲动倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我有时想摔门或砸东西来发泄情绪',
      dimension: '冲动倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '受到批评时我特别想顶嘴',
      dimension: '冲动倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我做事经常不考虑别人的感受',
      dimension: '冲动倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '考试成绩不理想时我会把试卷撕掉',
      dimension: '冲动倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
    {
      text: '我有时会突然想大哭一场',
      dimension: '冲动倾向',
      options: [
        { text: '是', score: 1 },
        { text: '否', score: 0 },
      ],
    },
  ],
  scoringRules: [
    { dimension: '学习焦虑', formulaType: 'sum' },
    { dimension: '对人焦虑', formulaType: 'sum' },
    { dimension: '孤独倾向', formulaType: 'sum' },
    { dimension: '自责倾向', formulaType: 'sum' },
    { dimension: '过敏倾向', formulaType: 'sum' },
    { dimension: '身体症状', formulaType: 'sum' },
    { dimension: '恐怖倾向', formulaType: 'sum' },
    { dimension: '冲动倾向', formulaType: 'sum' },
  ],
  scoreRanges: [
    {
      dimension: '学习焦虑',
      min: 0,
      max: 5,
      level: '正常',
      color: 'green',
      suggestion: '学习焦虑水平正常',
    },
    {
      dimension: '学习焦虑',
      min: 6,
      max: 10,
      level: '轻度异常',
      color: 'yellow',
      suggestion: '存在轻度学习焦虑，建议调整学习方法和心态',
    },
    {
      dimension: '学习焦虑',
      min: 11,
      max: 15,
      level: '明显异常',
      color: 'red',
      suggestion: '学习焦虑明显，建议寻求心理老师帮助',
    },
    {
      dimension: '对人焦虑',
      min: 0,
      max: 3,
      level: '正常',
      color: 'green',
      suggestion: '人际交往焦虑水平正常',
    },
    {
      dimension: '对人焦虑',
      min: 4,
      max: 7,
      level: '轻度异常',
      color: 'yellow',
      suggestion: '存在轻度社交焦虑，建议多参与集体活动',
    },
    {
      dimension: '对人焦虑',
      min: 8,
      max: 10,
      level: '明显异常',
      color: 'red',
      suggestion: '社交焦虑明显，建议进行社交技能训练',
    },
    {
      dimension: '孤独倾向',
      min: 0,
      max: 3,
      level: '正常',
      color: 'green',
      suggestion: '孤独倾向正常',
    },
    {
      dimension: '孤独倾向',
      min: 4,
      max: 7,
      level: '轻度异常',
      color: 'yellow',
      suggestion: '有一定孤独感，建议主动与同学交流',
    },
    {
      dimension: '孤独倾向',
      min: 8,
      max: 10,
      level: '明显异常',
      color: 'red',
      suggestion: '孤独感较强，建议寻求心理老师帮助',
    },
    {
      dimension: '自责倾向',
      min: 0,
      max: 3,
      level: '正常',
      color: 'green',
      suggestion: '自责倾向正常',
    },
    {
      dimension: '自责倾向',
      min: 4,
      max: 7,
      level: '轻度异常',
      color: 'yellow',
      suggestion: '有自责倾向，建议学会客观看待自己',
    },
    {
      dimension: '自责倾向',
      min: 8,
      max: 10,
      level: '明显异常',
      color: 'red',
      suggestion: '自责倾向明显，建议寻求心理辅导',
    },
    {
      dimension: '过敏倾向',
      min: 0,
      max: 3,
      level: '正常',
      color: 'green',
      suggestion: '敏感程度正常',
    },
    {
      dimension: '过敏倾向',
      min: 4,
      max: 7,
      level: '轻度异常',
      color: 'yellow',
      suggestion: '较为敏感，建议增强自信心',
    },
    {
      dimension: '过敏倾向',
      min: 8,
      max: 10,
      level: '明显异常',
      color: 'red',
      suggestion: '过度敏感，建议寻求心理老师帮助',
    },
    {
      dimension: '身体症状',
      min: 0,
      max: 5,
      level: '正常',
      color: 'green',
      suggestion: '身体状况正常',
    },
    {
      dimension: '身体症状',
      min: 6,
      max: 10,
      level: '轻度异常',
      color: 'yellow',
      suggestion: '有轻度身体不适，建议关注身体健康',
    },
    {
      dimension: '身体症状',
      min: 11,
      max: 15,
      level: '明显异常',
      color: 'red',
      suggestion: '身体症状明显，建议就医并关注心理状态',
    },
    {
      dimension: '恐怖倾向',
      min: 0,
      max: 3,
      level: '正常',
      color: 'green',
      suggestion: '恐怖倾向正常',
    },
    {
      dimension: '恐怖倾向',
      min: 4,
      max: 7,
      level: '轻度异常',
      color: 'yellow',
      suggestion: '有一定恐怖倾向，建议逐步面对恐惧',
    },
    {
      dimension: '恐怖倾向',
      min: 8,
      max: 10,
      level: '明显异常',
      color: 'red',
      suggestion: '恐怖倾向明显，建议寻求专业帮助',
    },
    {
      dimension: '冲动倾向',
      min: 0,
      max: 7,
      level: '正常',
      color: 'green',
      suggestion: '冲动倾向正常',
    },
    {
      dimension: '冲动倾向',
      min: 8,
      max: 13,
      level: '轻度异常',
      color: 'yellow',
      suggestion: '有一定冲动倾向，建议学习情绪管理',
    },
    {
      dimension: '冲动倾向',
      min: 14,
      max: 20,
      level: '明显异常',
      color: 'red',
      suggestion: '冲动倾向明显，建议接受情绪管理训练',
    },
    {
      dimension: '',
      min: 0,
      max: 64,
      level: '心理健康',
      color: 'green',
      suggestion: '整体心理健康状况良好',
    },
    {
      dimension: '',
      min: 65,
      max: 80,
      level: '需关注',
      color: 'yellow',
      suggestion: '部分维度需关注，建议与心理老师沟通',
    },
    {
      dimension: '',
      min: 81,
      max: 100,
      level: '需重点关注',
      color: 'red',
      suggestion: '建议尽快到心理咨询中心进行进一步评估',
    },
  ],
};

function generateOptionsString(
  options: { text: string; score: number }[],
): string {
  return options.map((o, i) => `${o.text}:${o.score}:${i}`).join('|');
}

async function generateTemplate(tmpl: ScaleTemplate): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  const infoSheet = workbook.addWorksheet('量表信息');
  infoSheet.getCell('A1').value = tmpl.name;
  infoSheet.getCell('A2').value = '1.0';
  infoSheet.getCell('A3').value = tmpl.description;

  const itemsSheet = workbook.addWorksheet('题目');
  itemsSheet.addRow([
    '序号',
    '题目',
    '题型',
    '排序',
    '维度',
    '反向计分',
    '选项',
  ]);
  tmpl.items.forEach((item, i) => {
    itemsSheet.addRow([
      i + 1,
      item.text,
      'single_choice',
      i + 1,
      item.dimension || '',
      false,
      generateOptionsString(item.options),
    ]);
  });

  const rulesSheet = workbook.addWorksheet('计分规则');
  rulesSheet.addRow(['维度', '公式类型', '权重']);
  tmpl.scoringRules.forEach((r) => {
    rulesSheet.addRow([r.dimension, r.formulaType, 1]);
  });

  const rangesSheet = workbook.addWorksheet('分数段');
  rangesSheet.addRow(['维度', '最低分', '最高分', '等级', '颜色', '建议']);
  tmpl.scoreRanges.forEach((r) => {
    rangesSheet.addRow([
      r.dimension,
      r.min,
      r.max,
      r.level,
      r.color,
      r.suggestion,
    ]);
  });

  const filepath = path.join(TEMPLATES_DIR, tmpl.filename);
  await workbook.xlsx.writeFile(filepath);
  console.log(`Generated: ${filepath}`);
}

async function main(): Promise<void> {
  await generateTemplate(SDS_ITEMS);
  await generateTemplate(SAS_ITEMS);
  await generateTemplate(MHT_ITEMS);
  console.log('Done.');
}

main().catch(console.error);
