const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../data_yangben/mbti_result.md');
const OUT = path.resolve(__dirname, '../data_yangben/mbti_reports.json');

function parseSections(md) {
  return md.split('\n---').map(s => s.trim()).filter(Boolean);
}

function detectGroup(type) {
  if (['ISTJ','ISFJ','ESTJ','ESFJ'].includes(type)) return '守护者联盟';
  if (['ISTP','ISFP','ESTP','ESFP'].includes(type)) return '探索者联盟';
  if (['INFJ','INFP','ENFJ','ENFP'].includes(type)) return '理想家联盟';
  if (['INTJ','INTP','ENTJ','ENTP'].includes(type)) return '理性者联盟';
  return '';
}

function parseOne(section) {
  const lines = section.split('\n').map(l => l.trim()).filter(Boolean);
  const head = lines.find(l => /^\d+\.\s+[A-Z]{4}\s+-\s+/.test(l));
  if (!head) return null;
  const mHead = head.match(/^\d+\.\s+([A-Z]{4})\s+-\s+(.+?)(\s|$)/);
  if (!mHead) return null;

  const mbti_type = mHead[1];
  const nicknameRaw = mHead[2];
  const nickname = nicknameRaw.replace(/[🛡️👑🌞🚀💡🎪🎯😇🔧🎨🌈🔍]+/g, '').trim();

  const aliasLine = lines.find(l => l.startsWith('别名：'));
  const title = aliasLine ? aliasLine.replace('别名：','').trim() : nickname;

  const profileStart = lines.findIndex(l => l.includes('人格画像'));
  const psychoIdx = lines.findIndex(l => l.startsWith('心理学解析'));
  const powersIdx = lines.findIndex(l => l.includes('超能力清单'));
  const funIdx = lines.findIndex(l => l.includes('有趣特征'));
  const careerIdx = lines.findIndex(l => l.includes('职场人格'));
  const loveIdx = lines.findIndex(l => l.includes('恋爱指南'));

  const description = profileStart >= 0 && psychoIdx > profileStart
    ? lines.slice(profileStart + 1, psychoIdx).join(' ')
    : '';

  const psychological_analysis = psychoIdx >= 0
    ? (() => {
        const end = [powersIdx, funIdx, careerIdx, loveIdx].filter(i => i > psychoIdx).sort((a,b)=>a-b)[0];
        return lines.slice(psychoIdx, end || lines.length).join(' ');
      })()
    : '';

  const superpowers = [];
  if (powersIdx >= 0) {
    for (let i = powersIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (l.includes('有趣特征') || l.includes('职场人格') || l.includes('恋爱指南') || /^\d+\.\s+[A-Z]{4}/.test(l)) break;
      if (l.startsWith('- ')) superpowers.push({ ability: l.replace('- ', '').trim(), description: l.replace('- ', '').trim() });
    }
  }

  const characteristics = { catchphrases: [], habits: [], social_style: '', relationship_style: '' };
  if (funIdx >= 0) {
    for (let i = funIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (l.includes('职场人格') || l.includes('恋爱指南') || /^\d+\.\s+[A-Z]{4}/.test(l)) break;
      if (l.startsWith('- ')) characteristics.habits.push(l.replace('- ','').trim());
    }
  }

  const suitable_roles = [];
  let motto = '';
  if (careerIdx >= 0) {
    const rolesIdx = lines.findIndex((l,idx) => idx > careerIdx && (l.startsWith('适合角色：') || l.includes('适合角色：')));
    if (rolesIdx >= 0) {
      for (let i = rolesIdx + 1; i < lines.length; i++) {
        const l = lines[i];
        if (!l.startsWith('- ')) break;
        suitable_roles.push(l.replace('- ', '').trim().replace(/^.*-\s*/, ''));
      }
    }
    const mottoIdx = lines.findIndex((l,idx) => idx > careerIdx && l.startsWith('工作金句：'));
    if (mottoIdx >= 0) motto = lines[mottoIdx].replace('工作金句：','').trim().replace(/^"|"$/g,'');
  }

  const love = { ideal_partner: '', relationship_mode: '', confession_style: '' };
  if (loveIdx >= 0) {
    for (let i = loveIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (!l || l.startsWith('---') || /^\d+\.\s+[A-Z]{4}/.test(l)) break;
      if (l.startsWith('理想型：')) love.ideal_partner = l.replace('理想型：','').trim();
      else if (l.startsWith('恋爱模式：')) love.relationship_mode = l.replace('恋爱模式：','').trim();
      else if (l.startsWith('表白方式：')) love.confession_style = l.replace('表白方式：','').trim();
    }
  }

  const imagery = (nicknameRaw.match(/[🛡️👑🌞🚀💡🎪🎯😇🔧🎨🌈🔍]/g)||[]).join('');

  return {
    mbti_type,
    metadata: { nickname, title, category: '' },
    personality_profile: { description, psychological_analysis, imagery },
    superpowers,
    characteristics,
    career_profile: { suitable_roles, motto },
    love_guide: love,
    personality_group: detectGroup(mbti_type)
  };
}

function run() {
  const md = fs.readFileSync(SRC, 'utf8');
  const sections = parseSections(md);
  const reports = [];
  for (const s of sections) {
    const r = parseOne(s);
    if (r) reports.push(r);
  }
  const finalReports = reports.filter(r => /^[E|I][S|N][T|F][J|P]$/.test(r.mbti_type));
  fs.writeFileSync(OUT, JSON.stringify({ reports: finalReports }, null, 2), 'utf8');
  console.log(`OK -> ${OUT}  共 ${finalReports.length} 条`);
}

run();


