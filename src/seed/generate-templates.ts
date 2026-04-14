import * as ExcelJS from 'exceljs';
import * as path from 'path';

const TEMPLATES_DIR = path.resolve(__dirname, 'templates');

interface ScaleTemplate {
  filename: string;
  name: string;
  description: string;
  items: { text: string; options: { text: string; score: number }[] }[];
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
      '',
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
  console.log('Done. MHT template needs to be created separately (100 items).');
}

main().catch(console.error);
