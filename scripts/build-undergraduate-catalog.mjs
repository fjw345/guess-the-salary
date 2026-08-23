import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = new URL('../output/bachelor-full-source.json', import.meta.url);
const outputPath = new URL('../apps/api/data/undergraduate-majors.json', import.meta.url);

const categories = {
  '01': '哲学',
  '02': '经济学',
  '03': '法学',
  '04': '教育学',
  '05': '文学',
  '06': '历史学',
  '07': '理学',
  '08': '工学',
  '09': '农学',
  10: '医学',
  12: '管理学',
  13: '艺术学',
};

const aliasesByName = {
  金融学: ['金融'],
  国际经济与贸易: ['国贸'],
  学前教育: ['幼教'],
  汉语言文学: ['中文'],
  网络与新媒体: ['新媒体'],
  文物与博物馆学: ['文博'],
  数学与应用数学: ['数学'],
  生物科学: ['生物'],
  地理信息科学: ['GIS'],
  数据科学与大数据技术: ['大数据'],
  计算机科学与技术: ['计算机', '计科'],
  软件工程: ['软件'],
  信息安全: ['网安'],
  物联网工程: ['物联网'],
  人工智能: ['AI'],
  电子信息工程: ['电子信息'],
  通信工程: ['通信'],
  微电子科学与工程: ['微电子'],
  光电信息科学与工程: ['光电'],
  电气工程及其自动化: ['电气'],
  机械设计制造及其自动化: ['机械'],
  材料科学与工程: ['材料'],
  能源与动力工程: ['热动'],
  新能源科学与工程: ['新能源'],
  土木工程: ['土木'],
  水利水电工程: ['水利'],
  测绘工程: ['测绘'],
  化学工程与工艺: ['化工'],
  航空航天工程: ['航空'],
  环境工程: ['环保'],
  食品科学与工程: ['食品'],
  机器人工程: ['机器人'],
  集成电路设计与集成系统: ['集成电路'],
  动物医学: ['兽医'],
  临床医学: ['临床'],
  口腔医学: ['口腔'],
  医学影像学: ['影像'],
  医学检验技术: ['检验'],
  护理学: ['护理'],
  康复治疗学: ['康复'],
  工商管理: ['工商'],
  市场营销: ['营销'],
  会计学: ['会计'],
  财务管理: ['财务'],
  审计学: ['审计'],
  人力资源管理: ['人力'],
  旅游管理: ['旅游'],
  信息管理与信息系统: ['信管'],
  电子商务: ['电商'],
  物流管理: ['物流'],
  工程造价: ['造价'],
  视觉传达设计: ['视觉传达'],
  服装与服饰设计: ['服装设计'],
  数字媒体艺术: ['数媒'],
};

const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const catalog = source.map((item) => {
  const code = String(item['专业代码']).trim();
  const name = String(item['专业名称']).trim();
  const category = categories[code.slice(0, 2)];
  if (!category) throw new Error(`无法识别本科专业 ${name}（${code}）的学科门类。`);
  return {
    id: `bachelor-${code.toLowerCase()}`,
    name,
    category,
    degreeTypes: ['BACHELOR'],
    code,
    aliases: aliasesByName[name] ?? [],
  };
});

await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
console.log(`整理出 ${catalog.length} 个本科专业。`);
