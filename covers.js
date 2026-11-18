/* Original vector cover system. Only fixed artwork enters the SVG markup. */
const palettes = [
  ['#d9dbbd','#283e36','#ab6b43','#f3edd0'],
  ['#ede0c7','#563931','#aa593c','#f5dda4'],
  ['#cfddd7','#283f4a','#507f80','#ebefe4'],
  ['#e8d8d5','#512f40','#a86b76','#f6e8dd'],
  ['#dfdec9','#374838','#8d9070','#f5efd7'],
  ['#e4d7c8','#423c51','#7c677c','#f4daba']
];
const motifs = [
  (a,b,c,d) => `<circle cx="207" cy="79" r="32" fill="${c}"/><path d="M0 197 124 62l32 44 38-19 126 96v37H0Z" fill="${b}"/><path d="m0 210 113-99 20 31 42-22 145 66v34H0Z" fill="${c}"/><path d="m87 220 80-87-18 32 55-17-44 72Z" fill="${d}"/><path d="M54 53h62m-62 7h32" stroke="${b}"/>`,
  (a,b,c,d) => `<circle cx="160" cy="113" r="67" fill="${d}"/><path d="M127 220V87l34-25 34 25v133Z" fill="${b}"/><path d="M150 220V96h22v124Z" fill="${c}"/><path d="m65 220 85-87m-113 87 113-63m105 63-83-87m113 87-113-63" stroke="${b}" fill="none"/><path d="M109 220v-89m105 89v-89" stroke="${b}"/>`,
  (a,b,c,d) => `<path d="M0 148q40-39 80-22t80 0 80 0 80 0v94H0Z" fill="${c}"/><path d="M0 173q40-39 80-22t80 0 80 0 80 0v69H0Z" fill="${b}"/><path d="M0 197q40-39 80-22t80 0 80 0 80 0m-320 47q40-39 80-22t80 0 80 0 80 0" fill="none" stroke="${a}"/><path d="M142 124h68l-12 12h-44Z" fill="${d}"/><path d="M174 68v52h-25Z" fill="${b}"/><path d="M178 77v43h26Z" fill="${d}"/><circle cx="67" cy="63" r="18" fill="${d}"/>`,
  (a,b,c,d) => `<path d="M0 220 121 72h76l123 148Z" fill="${c}"/><path d="M109 220V102a51 51 0 0 1 102 0v118Z" fill="${b}"/><path d="M130 220V103a30 30 0 0 1 60 0v117Z" fill="${d}"/><circle cx="161" cy="122" r="10" fill="${c}"/><path d="M45 220 144 137h31l101 83Z" fill="${b}"/><path d="m160 139-61 81m61-81 58 81m-58-81v81m-92-17h183m-160-22h138" fill="none" stroke="${d}"/>`,
  (a,b,c,d) => `<circle cx="160" cy="114" r="70" fill="${d}"/><g stroke="${b}" fill="none"><circle cx="160" cy="114" r="73"/><circle cx="160" cy="114" r="78" stroke-dasharray="1 5"/><path d="M41 114h238M160 24v181"/><ellipse cx="160" cy="114" rx="38" ry="73"/></g><path d="m160 62 12 40 40 12-40 12-12 40-12-40-40-12 40-12Z" fill="${c}"/><circle cx="160" cy="114" r="9" fill="${b}"/><circle cx="45" cy="114" r="3" fill="${b}"/><circle cx="275" cy="114" r="3" fill="${b}"/>`,
  (a,b,c,d) => `<path d="M25 173h270v47H25Z" fill="${b}"/><circle cx="160" cy="97" r="47" fill="${d}"/><path d="M51 171v-39h37v-21h20v60Zm60 0V93h37v78Zm44 0v-35h23v35Zm34 0V72h33v99Zm40 0v-62h41v62Z" fill="${b}"/><path d="M53 174h214M51 183h219m-213 10h208m-177 11h153" stroke="${c}"/><path d="M125 111v43m9-43v43m67-64v56m9-56v56m37-22v32m10-32v32" stroke="${d}"/>`
];
const demoMotifs = Object.freeze({'demo-1':0,'demo-2':3,'demo-3':2,'demo-4':5,'demo-5':4,'demo-6':1});
const glyph = {book:'B', film:'F', movie:'F', series:'S'};

export function cover(entry, index = 0) {
  const key = String(entry.id ?? entry.title ?? index);
  const hash = [...key].reduce((n, char) => (Math.imul(n, 31) + char.codePointAt(0)) >>> 0, 0);
  const p = hash % palettes.length;
  const m = (Object.hasOwn(demoMotifs, key)) ? demoMotifs[key] : (Math.floor(hash / palettes.length) + (entry.type === 'series' ? 2 : 0)) % motifs.length;
  const [a,b,c,d] = palettes[p];
  const number = String(m + 1).padStart(2, '0');
  const letter = Object.hasOwn(glyph, entry.type) ? glyph[entry.type] : '•';
  return `<div class="cover" aria-hidden="true"><svg viewBox="0 0 320 220" preserveAspectRatio="xMidYMid slice" focusable="false"><path d="M0 0h320v220H0Z" fill="${a}"/>${motifs[m](a,b,c,d)}<path d="M14 29V14h15m262 0h15v15m0 162v15h-15M29 206H14v-15" fill="none" stroke="${b}" opacity=".62"/><text x="23" y="35" fill="${b}" font-size="9" font-family="monospace">${letter} / ${number}</text></svg></div>`;
}
