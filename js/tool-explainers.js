/* Scripts for the tool explainers (played by js/tool-explainer.js).
   step = {t: title, c: caption, d: length in ms, a: [[offset, command, key, value, duration]]}
   commands: mv/clk (cursor), on/off/pick, set, type, fill, show/hide, panel, css, toast, focus/blur, page */
const R = (l, h) => `<div class="xp-r"><span>${l}</span>${h}</div>`;
const IN = (k, ph) => `<div class="xp-in" data-k="${k}"><em>${ph}</em><span class="t"></span></div>`;
const SEL = (k, v) => `<div class="xp-sel" data-k="${k}"><span class="t">${v}</span><i></i></div>`;
const B = (k, l, c = '') => `<div class="xp-b ${c}" data-k="${k}">${l}</div>`;
const CB = (k, l, on) => `<div class="xp-cb${on ? ' on' : ''}" data-k="${k}"><i></i>${l}</div>`;
const SG = (k, arr, sel = 0) => `<div class="xp-sg">${arr.map((a, i) => `<span data-k="${k}${i}"${i === sel ? ' class="on"' : ''}>${a}</span>`).join('')}</div>`;
const BAR = k => `<div class="xp-bar xp-h" data-k="${k}"><i></i></div>`;
const ST = (k, t) => `<div class="xp-st xp-h" data-k="${k}">${t}</div>`;
const LI = (k, l, b, c = '') => `<div class="xp-li" data-k="${k}"><span>${l}</span><b class="${c}">${b}</b></div>`;
const H = (k, h) => `<div class="xp-h" data-k="${k}">${h}</div>`;
/* cursor helper: move to key, click it 0.95s later */
const C = (t, k, ...more) => [[t, 'mv', k], [t + 950, 'clk', k], ...more];
const ARM = (c = '#7fa0ff') => `<g fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path class="t" data-k="arm" d="M70 250L140 150L235 195"/></g><g fill="#cfe0ff"><circle cx="70" cy="250" r="8"/><circle cx="140" cy="150" r="8"/><circle class="t" data-k="wr" cx="235" cy="195" r="9"/></g>`;
const CUBE = (k = 'ctl') => `<rect class="t" data-k="${k}" x="215" y="176" width="40" height="40" rx="6" fill="rgba(255,184,77,.12)" stroke="#8791b3" stroke-width="2"/>`;
const LOC = (k, x, y) => `<g class="t" data-k="${k}" opacity="0" style="translate:${x}px ${y}px"><path d="M-12 0H12M0 -12V12" stroke="#3DDC97" stroke-width="3" stroke-linecap="round"/><circle r="5" fill="none" stroke="#3DDC97" stroke-width="2"/></g>`;
const FILE = (k, x, y, n, c) => `<g class="t" data-k="${k}" style="translate:${x}px ${y}px"><rect width="64" height="50" rx="8" fill="#232a3d" stroke="${c}" stroke-width="2"/><text x="32" y="30" text-anchor="middle" fill="${c}">${n}</text></g>`;
const P = { x: 330, y: 22, w: 288 };
const toast = (t, s, m) => [t, 'toast', m];

export default {
  rivet: {
    title: 'Rivet', ix: 8, file: 'shot_010_rig.ma',
    scene: `<g class="t" data-k="mesh"><path d="M60 250L130 120L260 140L300 270Z" fill="rgba(109,170,255,.1)" stroke="#6a7aa8" stroke-width="2"/></g><path class="t" data-k="edges" d="M130 120L260 140" stroke="#8791b3" stroke-width="4" stroke-linecap="round"/>${LOC('loc', 195, 130)}<g class="t" data-k="obj" opacity="0" style="translate:150px 60px"><rect width="38" height="38" rx="6" fill="#ffb84d"/></g>`,
    panel: { ...P, y: 120, w: 270, html: R('Selection', '<span class="xp-v">2 edges</span>') + B('go', 'Rivet', 'main full') + H('res', R('Created', '<span class="xp-v">rivet_loc1</span>') + R('Parent', SEL('par', 'rivet_loc1'))) },
    steps: [
      { t: 'Select two edges', c: 'Pick two polygon edges, or one NURBS point, where the object should stick.', d: 3400, a: [[300, 'mv', 'edges'], [1200, 'clk', 'edges'], [1300, 'on', 'edges']] },
      { t: 'Click Rivet', c: 'The shelf button builds a locator that follows the surface.', d: 3800, a: [[0, 'mv', 'sh'], [950, 'clk', 'sh'], [1100, 'panel', 'show'], [1800, 'mv', 'go'], [2700, 'clk', 'go'], [2800, 'css', 'loc', 'opacity', 1]] },
      { t: 'Parent your object', c: 'Parent anything to the locator. One undo step removes it all.', d: 4200, a: [[0, 'show', 'res'], [400, 'css', 'obj', 'opacity', 1], [1600, 'css', 'obj', 'translate', '176px 96px'], [2400, 'toast', 'Object follows the surface'], [3600, 'untoast']] },
    ],
  },
  'ik-fk-snap': {
    title: 'IK / FK Snap', ix: 0, group: 'free', file: 'arm_rig_v03.ma', cursor: [420, 300],
    scene: ARM() + CUBE('ctl'),
    panel: { ...P, html: R('FK shoulder', IN('f1', 'pick…')) + R('IK wrist', IN('f2', 'pick…')) + R('Pole vector', IN('f3', 'pick…')) + H('ok', ST('v', '✓ Setup valid')) + `<div class="xp-row2">${B('b1', 'Validate', 'go')}${B('b2', 'IK → FK', 'main')}${B('b3', 'FK → IK', 'main')}</div>` },
    steps: [
      { t: 'Assign controls', c: 'Select each control and assign shoulder, wrist and pole vector.', d: 4200, a: [[0, 'mv', 'sh'], [950, 'clk', 'sh'], [1100, 'panel', 'show'], [1500, 'type', 'f1', 'L_FK_shoulder_CTRL', 700], [2300, 'type', 'f2', 'L_IK_wrist_CTRL', 700], [3100, 'type', 'f3', 'L_poleVector_CTRL', 700]] },
      { t: 'Validate setup', c: 'One click checks every control and the elbow axis.', d: 3200, a: C(200, 'b1').concat([[1300, 'show', 'v'], [1400, 'show', 'ok']]) },
      { t: 'Snap IK → FK', c: 'Match one rig to the other without the pose jumping.', d: 4200, a: C(0, 'b2').concat([[1100, 'css', 'wr', 'cx', 300], [1100, 'css', 'arm', 'd', 'path("M70 250L140 150L300 195")'], [2000, 'toast', 'Snapped · pose matched'], [3600, 'untoast']]) },
    ],
  },
  'multi-swapper': {
    title: 'Multi Swapper', ix: 1, group: 'free', file: 'shot_020_anim.ma',
    scene: `<rect class="t" data-k="a" x="60" y="150" width="46" height="46" rx="8" fill="rgba(109,170,255,.2)" stroke="#6DAAFF" stroke-width="2"/><rect class="t" data-k="b" x="180" y="150" width="46" height="46" rx="8" fill="rgba(255,184,77,.2)" stroke="#FFB84D" stroke-width="2"/>${LOC('l1', 83, 90)}${LOC('l2', 203, 90)}`,
    panel: { ...P, html: R('Selected', '<span class="xp-v">2 animated objects</span>') + B('copy', 'Copy Anim', 'main full') + H('st', ST('s1', '✓ 2 locators, keys cleared') + R('Transfer', SG('tm', ['Translates', 'Rotates', 'Both'], 2)) + B('xfer', 'Transfer', 'go full')) },
    steps: [
      { t: 'Select objects', c: 'Select the animated objects you want to swap.', d: 3000, a: [[300, 'mv', 'a'], [1000, 'clk', 'a'], [1100, 'on', 'a'], [1500, 'on', 'b']] },
      { t: 'Copy Anim', c: 'A locator per object takes the motion, baked in world space.', d: 3800, a: [[0, 'mv', 'sh'], [950, 'clk', 'sh'], [1100, 'panel', 'show'], [1800, 'mv', 'copy'], [2500, 'clk', 'copy'], [2600, 'css', 'l1', 'opacity', 1], [2700, 'css', 'l2', 'opacity', 1], [2800, 'show', 'st']] },
      { t: 'Edit and Transfer', c: 'Rework the motion on the locators, then send it back.', d: 4200, a: [[0, 'css', 'l1', 'translate', '83px 120px'], [700, 'mv', 'xfer'], [1700, 'clk', 'xfer'], [1800, 'css', 'a', 'translate', '0px -30px'], [1900, 'toast', 'Animation transferred'], [3600, 'untoast']] },
    ],
  },
  'udim-preview': {
    title: 'UDIM Preview', ix: 2, group: 'free', file: 'asset_look_v02.ma',
    scene: `<g class="t" data-k="tiles"><rect x="60" y="120" width="70" height="70" fill="#27304a" stroke="#6a7aa8"/><rect x="132" y="120" width="70" height="70" fill="#27304a" stroke="#6a7aa8"/><rect x="204" y="120" width="70" height="70" fill="#27304a" stroke="#6a7aa8"/><text x="95" y="160" text-anchor="middle">1001</text><text x="167" y="160" text-anchor="middle">1002</text><text x="239" y="160" text-anchor="middle">1003</text></g>`,
    panel: { ...P, html: R('Quality', SEL('q', 'Medium')) + H('lst', LI('q1', 'Draft', '') + LI('q2', 'Medium', 'saved', 'g') + LI('q3', 'High 4k', '')) + B('gen', 'Generate', 'main full') + BAR('pr') },
    steps: [
      { t: 'Open from the shelf', c: 'One shelf button opens UDIM Preview inside Maya.', d: 2800, a: C(0, 'sh').concat([[1100, 'panel', 'show']]) },
      { t: 'Choose quality', c: 'Draft to 8k. Your choice is remembered.', d: 3400, a: C(300, 'q').concat([[1300, 'show', 'lst'], [1900, 'on', 'q2'], [2200, 'set', 'q', 'High 2k']]) },
      { t: 'Generate', c: 'Textures load with a progress bar. No UDIMs means no changes.', d: 4200, a: C(0, 'gen').concat([[1100, 'fill', 'pr', 2200], [3500, 'toast', 'UDIM tiles previewed'], [4100, 'untoast']]) },
    ],
  },
  'layer-prefix-remover': {
    title: 'Layer Prefix Remover', ix: 3, group: 'free', file: 'layers_cleanup.ma',
    scene: '',
    panel: { ...P, html: R('Layer type', SG('lt', ['Display', 'Render'])) + R('Prefix', IN('pf', 'e.g. old_')) + R('Replace with', IN('rp', 'empty = remove')) + `<div class="xp-li" data-k="la"><span>old_geo</span><b>old_</b></div><div class="xp-li" data-k="lb"><span>old_rig</span><b>old_</b></div><div class="xp-li"><span>defaultLayer</span><b class="a">skipped</b></div>` + B('go', 'Rename Layers', 'main full') },
    steps: [
      { t: 'Pick the layer type', c: 'Display or Render layers.', d: 2600, a: [[0, 'mv', 'sh'], [950, 'clk', 'sh'], [1000, 'panel', 'show'], [1500, 'mv', 'lt1'], [2000, 'clk', 'lt1'], [2100, 'pick', 'lt1']] },
      { t: 'Enter the prefix', c: 'Type the exact prefix. Leave the replacement empty to remove it.', d: 3600, a: [[0, 'mv', 'pf'], [500, 'focus', 'pf'], [700, 'type', 'pf', 'old_', 600], [1700, 'blur'], [1800, 'mv', 'rp'], [2200, 'focus', 'rp']] },
      { t: 'Rename Layers', c: 'Default, locked and referenced layers are skipped safely.', d: 3600, a: [[0, 'blur'], [100, 'mv', 'go'], [1000, 'clk', 'go'], [1200, 'set', 'la', 'geo'], [1400, 'set', 'lb', 'rig'], [2000, 'toast', '2 layers renamed'], [3200, 'untoast']] },
    ],
  },
  'drag-drop': {
    title: 'Drag & Drop', ix: 9, file: 'shot_030_layout.ma', cursor: [420, 130],
    scene: FILE('f1', 40, 70, '.fbx', '#6DAAFF') + FILE('f2', 40, 140, '.abc', '#3DDC97') + FILE('f3', 40, 210, '.ma', '#FFB84D'),
    panel: { ...P, html: H('rows', LI('r1', 'cam.fbx', 'Import', 'g') + LI('r2', 'crowd.abc', 'Reference', 'g') + LI('r3', 'props.ma', 'Add to Bucket', 'a')) + `<div style="height:62px"></div>` + H('pgs', BAR('pr')) + B('ok', 'Confirm', 'main full') },
    steps: [
      { t: 'Drop your files', c: 'Drag several files into the Maya window at once.', d: 3800, a: [[0, 'mv', 'f1'], [800, 'css', 'f1', 'translate', '150px 90px'], [1000, 'css', 'f2', 'translate', '190px 120px'], [1200, 'css', 'f3', 'translate', '230px 150px'], [2400, 'panel', 'show'], [2500, 'show', 'rows']] },
      { t: 'Choose an action', c: 'Import, Reference, Open in new Maya, Add to Bucket or Skip. Per file.', d: 3600, a: [[200, 'mv', 'r1'], [1000, 'on', 'r1'], [1700, 'mv', 'r2'], [2200, 'on', 'r2'], [2800, 'mv', 'r3'], [3200, 'on', 'r3']] },
      { t: 'Confirm', c: 'A progress bar runs the whole batch. You can stop it any time.', d: 4000, a: C(0, 'ok').concat([[1100, 'show', 'pgs'], [1200, 'fill', 'pr', 1800], [3200, 'toast', 'Done · 3 files processed'], [3900, 'untoast']]) },
    ],
  },
  'fbx-exporter': {
    title: 'FBX Exporter', ix: 3, file: 'shot_040_anim.ma',
    scene: `<g class="t" data-k="rig"><circle cx="150" cy="100" r="16" fill="#cfe0ff"/><path d="M150 116V190M150 130L110 170M150 130L190 170M150 190L125 250M150 190L175 250" stroke="#7fa0ff" stroke-width="6" stroke-linecap="round" fill="none"/></g>`,
    panel: { ...P, html: R('Shot', IN('sn', 'SH_010')) + R('Project', IN('pc', 'code')) + R('Rigs', '<span class="xp-v">Use Maya selection</span>') + CB('c1', 'Bake every frame') + CB('c2', 'Cameras') + CB('c3', 'Overwrite') + BAR('pr') + B('ex', 'Export FBX', 'main full') },
    steps: [
      { t: 'Set destination', c: 'Project folder, shot number and code build names like SH_010_Asset.fbx.', d: 3600, a: [[0, 'mv', 'sh'], [950, 'clk', 'sh'], [1100, 'panel', 'show'], [1500, 'focus', 'sn'], [1700, 'type', 'sn', 'SH_010', 600], [2500, 'focus', 'pc'], [2700, 'type', 'pc', 'AJ_CHR', 600]] },
      { t: 'Pick rigs', c: 'Tick rigs in the list or use your Maya selection.', d: 3000, a: [[0, 'blur'], [300, 'on', 'rig'], [200, 'mv', 'c1']] },
      { t: 'Set options', c: 'Bake every frame, add cameras, choose overwrite.', d: 3400, a: [[0, 'mv', 'c1'], [800, 'clk', 'c1'], [900, 'on', 'c1'], [1500, 'mv', 'c2'], [2300, 'clk', 'c2'], [2400, 'on', 'c2']] },
      { t: 'Export', c: 'Watch the log. Esc cancels.', d: 3800, a: C(0, 'ex').concat([[1100, 'fill', 'pr', 1800], [3000, 'toast', 'SH_010_AJ_CHR.fbx exported'], [3700, 'untoast']]) },
    ],
  },
  'alembic-exporter': {
    title: 'Alembic Exporter', ix: 1, file: 'shot_050_final.ma',
    scene: `<g class="t" data-k="rig"><rect x="70" y="140" width="60" height="70" rx="10" fill="rgba(109,170,255,.2)" stroke="#6DAAFF" stroke-width="2"/><rect x="170" y="150" width="70" height="60" rx="10" fill="rgba(255,184,77,.2)" stroke="#FFB84D" stroke-width="2"/></g>`,
    panel: { ...P, html: R('Shot', SEL('sh2', 'SH_050')) + `<div style="margin:2px 0">${LI('a1', 'Characters', '3', 'g')}${LI('a2', 'Cameras', '1', 'g')}</div>` + CB('o1', 'UV Write', true) + CB('o2', 'World Space') + CB('o3', 'Strip Namespaces') + H('chk', ST('ck', '✓ Check passed · 1 warning')) + BAR('pr') + B('go', 'Export', 'main full') },
    steps: [
      { t: 'Set the shot', c: 'Choose project and shot so files are named correctly.', d: 3000, a: [[0, 'mv', 'sh'], [950, 'clk', 'sh'], [1100, 'panel', 'show'], [1800, 'mv', 'sh2'], [2400, 'clk', 'sh2']] },
      { t: 'Sort assets', c: 'Characters, props and cameras go into categories.', d: 3000, a: [[0, 'mv', 'a1'], [800, 'on', 'a1'], [1500, 'mv', 'a2'], [2200, 'on', 'a2']] },
      { t: 'Choose options', c: 'Range, UVs, visibility, world space, overwrite policy.', d: 3400, a: C(0, 'o2').concat([[1100, 'on', 'o2'], [1600, 'mv', 'o3'], [2400, 'clk', 'o3'], [2500, 'on', 'o3']]) },
      { t: 'Check and Export', c: 'Errors stop the export. Warnings are listed.', d: 4200, a: [[0, 'show', 'chk'], [1000, 'mv', 'go'], [1900, 'clk', 'go'], [2000, 'fill', 'pr', 1600], [3300, 'toast', 'Alembic exported'], [4000, 'untoast']] },
    ],
  },
  'audio-exporter': {
    title: 'Audio Exporter', ix: 2, file: 'any_scene.ma',
    scene: `<g class="t" data-k="vid"><rect x="60" y="110" width="200" height="120" rx="10" fill="#232a3d" stroke="#6a7aa8" stroke-width="2"/><path d="M135 150L190 170L135 190Z" fill="#8791b3"/></g><path class="t" data-k="wave" opacity="0" d="M70 280h10v-14h10v28h10v-40h10v52h10v-30h10v14h10v-24h10v12h10v-8h10v6h10" fill="none" stroke="#3DDC97" stroke-width="3"/>`,
    panel: { ...P, html: R('Files', '<span class="xp-v">scene_cut.mov</span>') + R('Name', IN('nm', '{name}_{date}')) + CB('c1', 'Loudness levelling') + CB('c2', 'Skip existing', true) + H('pv', ST('p', 'scene_cut_2026-11-06.wav')) + BAR('pr') + B('ex', 'Export WAV', 'main full') },
    steps: [
      { t: 'Drop video files', c: 'MOV, MP4, AVI, M4V or MKV, one or many.', d: 3000, a: [[0, 'css', 'vid', 'translate', '0px 0px'], [400, 'mv', 'vid'], [1200, 'css', 'vid', 'translate', '130px -20px'], [1500, 'panel', 'show']] },
      { t: 'Name the output', c: 'Tokens {name}, {index}, {date} with a live preview.', d: 3400, a: [[0, 'mv', 'nm'], [500, 'focus', 'nm'], [700, 'type', 'nm', '{name}_{date}', 900], [1900, 'blur'], [2000, 'show', 'pv']] },
      { t: 'Pick options', c: 'Scene import, loudness levelling, skip existing files.', d: 3000, a: C(0, 'c1').concat([[1100, 'on', 'c1']]) },
      { t: 'Export', c: '48 kHz 16-bit stereo WAV. Esc cancels.', d: 4000, a: C(0, 'ex').concat([[1100, 'fill', 'pr', 1800], [1200, 'css', 'wave', 'opacity', 1], [3100, 'toast', 'WAV exported'], [3800, 'untoast']]) },
    ],
  },
  'hotkey-manager': {
    title: 'Hotkey Manager', ix: 4, file: 'any_scene.ma',
    scene: '',
    panel: { ...P, html: R('Hotkey set', SEL('hs', 'Studio')) + H('lst', LI('k1', 'Studio', '', '') + LI('k2', 'Animation', '', '') + LI('k3', 'Maya default', '', '')) + `<div class="xp-li"><span>Ctrl+G</span><b class="g">Group</b></div><div class="xp-li"><span>Alt+S</span><b class="g">Set key</b></div>` + CB('bk', 'Export a backup first') + B('ap', 'Apply Hotkeys', 'main full') },
    steps: [
      { t: 'Choose a set', c: 'Pick a ready-made hotkey set.', d: 3000, a: [[0, 'mv', 'sh'], [950, 'clk', 'sh'], [1100, 'panel', 'show'], [1600, 'mv', 'hs'], [2300, 'clk', 'hs'], [2400, 'show', 'lst'], [2800, 'on', 'k2']] },
      { t: 'Back up first', c: 'Export your current hotkeys or browse a file.', d: 2800, a: C(0, 'bk').concat([[1100, 'on', 'bk']]) },
      { t: 'Preview mapping', c: 'See what changes before anything is applied.', d: 2600, a: [[0, 'set', 'hs', 'Animation'], [300, 'off', 'k2']] },
      { t: 'Apply Hotkeys', c: 'Revert restores your snapshot in one click.', d: 3400, a: C(0, 'ap').concat([[1100, 'toast', 'Hotkeys applied'], [3000, 'untoast']]) },
    ],
  },
  'rebake-ik-space': {
    title: 'Rebake IK Space', ix: 6, file: 'shot_060_anim.ma',
    scene: ARM('#7fa0ff') + CUBE('ctl'),
    panel: { ...P, html: R('Controls', B('pk', 'Pick', 'go')) + R('Operation', SEL('op', 'Follow New Parent')) + R('Parent', IN('pa', 'COG_CTRL')) + R('Frames', '<span class="xp-v">1001 – 1085</span>') + BAR('pr') + H('lg', '<div class="xp-log"><div class="vis ok">✓ L_wrist_IK baked</div><div class="vis ok">✓ R_wrist_IK baked</div></div>') + B('go', 'Run', 'main full') },
    steps: [
      { t: 'Select IK controls', c: 'Select controls, then press Pick.', d: 3000, a: [[0, 'on', 'ctl'], [200, 'mv', 'sh'], [1150, 'clk', 'sh'], [1250, 'panel', 'show'], [1900, 'mv', 'pk'], [2500, 'clk', 'pk']] },
      { t: 'Choose operation', c: 'Follow New Parent, Finalize to Parent or Bake to World.', d: 3400, a: C(0, 'op').concat([[1300, 'set', 'op', 'Bake to World'], [1900, 'mv', 'pa'], [2400, 'focus', 'pa']]) },
      { t: 'Set frames and Run', c: 'Pick the range and run. A log shows each result.', d: 4000, a: [[0, 'blur'], [100, 'mv', 'go'], [1000, 'clk', 'go'], [1100, 'fill', 'pr', 1600], [2800, 'show', 'lg'], [3000, 'toast', 'Rebake finished'], [3800, 'untoast']] },
    ],
  },
  'revert-to-last-saved': {
    title: 'Revert to Last Saved', ix: 7, file: 'shot_070_anim.ma  *',
    scene: `<g class="t" data-k="doc"><rect x="100" y="90" width="120" height="150" rx="10" fill="#232a3d" stroke="#6a7aa8" stroke-width="2"/><path d="M120 130h80M120 160h80M120 190h50" stroke="#6a7aa8" stroke-width="4" stroke-linecap="round"/></g>`,
    panel: { ...P, y: 100, html: ST('s', '') + `<div class="xp-r"><span>Unsaved changes found</span></div>` + `<div class="xp-row2">${B('no', 'Cancel')}${B('yes', 'Revert', 'go')}</div>` + H('bk', R('Backup', '<span class="xp-v">shot_070_bak.ma</span>')) },
    steps: [
      { t: 'Click the shelf button', c: 'One button on your shelf. No menus.', d: 2800, a: [[0, 'mv', 'sh'], [950, 'clk', 'sh']] },
      { t: 'Confirm', c: 'If you have unsaved work, Maya asks before anything happens.', d: 3000, a: [[0, 'panel', 'show'], [900, 'mv', 'yes'], [1800, 'clk', 'yes']] },
      { t: 'Saved version opens', c: 'A backup of what you had is kept first, and the message tells you where.', d: 3800, a: [[0, 'panel', 'show'], [200, 'show', 'bk'], [1000, 'css', 'doc', 'opacity', 0.2], [1600, 'css', 'doc', 'opacity', 1], [1700, 'toast', 'Reverted · backup saved'], [3300, 'untoast']] },
    ],
  },
  'advanced-ik-fk-switch': {
    title: 'Advanced IK FK Switch', ix: 0, file: 'shot_020_rig.ma', cursor: [420, 300],
    scene: ARM('#7fa0ff') + CUBE('ctl'),
    panel: { ...P, html: R('Rig', SEL('rg', 'Hero_rig')) + R('Limb', SEL('lb', 'L_arm')) + R('Mode', SG('m', ['IK', 'FK'], 0)) + CB('k1', 'Key the switch', true) + CB('k2', 'Match range') + BAR('pr') + B('go', 'Switch', 'main full') },
    steps: [
      { t: 'Pick the limb', c: 'Choose the rig and the arm or leg you want to switch.', d: 3200, a: [[0, 'mv', 'sh'], [950, 'clk', 'sh'], [1100, 'panel', 'show'], [1700, 'mv', 'lb'], [2400, 'clk', 'lb']] },
      { t: 'Choose the mode', c: 'IK or FK, with the pose matched so nothing pops.', d: 3000, a: [[0, 'mv', 'm1'], [900, 'clk', 'm1'], [1000, 'pick', 'm1'], [1200, 'css', 'arm', 'opacity', .7]] },
      { t: 'Switch with keys', c: 'One click switches and keys it across your range.', d: 3800, a: C(0, 'go').concat([[1100, 'fill', 'pr', 1500], [2800, 'toast', 'Switched to FK · keyed'], [3500, 'untoast']]) },
    ],
  },
  playblast: {
    title: 'Playblast', ix: 5, file: 'shot_030_anim.ma',
    scene: `<g class="t" data-k="cam"><rect x="70" y="100" width="200" height="130" rx="8" fill="none" stroke="#6a7aa8" stroke-width="2" stroke-dasharray="6 5"/><circle cx="170" cy="165" r="26" fill="rgba(109,170,255,.2)" stroke="#6DAAFF" stroke-width="2"/></g>`,
    panel: { ...P, html: R('Camera', SEL('cm', 'persp')) + R('Size', SEL('sz', '1920 × 1080')) + R('Format', SEL('fm', 'H.264 MP4')) + CB('o1', 'Open when done', true) + BAR('pr') + B('go', 'Playblast', 'main full') },
    steps: [
      { t: 'Choose the camera', c: 'Pick the camera and the size you want to review at.', d: 3200, a: [[0, 'mv', 'sh'], [950, 'clk', 'sh'], [1100, 'panel', 'show'], [1700, 'mv', 'cm'], [2400, 'clk', 'cm'], [2500, 'on', 'cam']] },
      { t: 'Set the format', c: 'MP4 with the right settings, no manual codec hunting.', d: 3000, a: [[0, 'mv', 'fm'], [800, 'clk', 'fm'], [900, 'set', 'fm', 'H.264 MP4']] },
      { t: 'Playblast', c: 'Records the viewport and opens the movie when done.', d: 3800, a: C(0, 'go').concat([[1100, 'fill', 'pr', 1600], [2900, 'toast', 'Playblast saved'], [3600, 'untoast']]) },
    ],
  },
};
