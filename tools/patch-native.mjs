// Small fixes to the generated native projects. Safe to run any number of times.
//   node tools/patch-native.mjs android|ios
// Android: lock the game to portrait.
// iOS: portrait only on iPhone; iPad stays portrait and runs full screen.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const which = process.argv[2];

if (which === 'android') {
  const f = 'android/app/src/main/AndroidManifest.xml';
  if (!existsSync(f)) throw new Error(`${f} not found; run "npx cap add android" first`);
  let x = readFileSync(f, 'utf8');
  if (!x.includes('android:screenOrientation')) {
    x = x.replace(/<activity(\s)/, '<activity android:screenOrientation="portrait"$1');
    writeFileSync(f, x);
    console.log('Android: locked to portrait');
  } else console.log('Android: orientation already set');
}

if (which === 'ios') {
  const f = 'ios/App/App/Info.plist';
  if (!existsSync(f)) throw new Error(`${f} not found; run "npx cap add ios" first`);
  let x = readFileSync(f, 'utf8');
  const arr = (...v) => `<array>\n${v.map(s => `\t\t<string>${s}</string>`).join('\n')}\n\t</array>`;
  const setKey = (key, value) => {
    const re = new RegExp(`<key>${key.replace(/[~]/g, '\\$&')}</key>\\s*(<array>[\\s\\S]*?</array>|<true/>|<false/>|<string>[^<]*</string>)`);
    x = re.test(x) ? x.replace(re, `<key>${key}</key>\n\t${value}`) : x.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>${key}</key>\n\t${value}\n</dict>\n</plist>\n`);
  };
  setKey('UISupportedInterfaceOrientations', arr('UIInterfaceOrientationPortrait'));
  setKey('UISupportedInterfaceOrientations~ipad', arr('UIInterfaceOrientationPortrait', 'UIInterfaceOrientationPortraitUpsideDown'));
  setKey('UIRequiresFullScreen', '<true/>');
  setKey('UIStatusBarStyle', '<string>UIStatusBarStyleLightContent</string>');
  writeFileSync(f, x);
  console.log('iOS: portrait only, full screen, light status bar');
}
