// Videoyu geçici public bir HTTPS URL'ine yükler (IG API video_url'i sunucu tarafından çeker).
// catbox.moe: ücretsiz, anonim, kalıcı, direct link. CI'da bunun yerine GitHub Pages/raw kullanılabilir.
import {execFileSync} from 'node:child_process';

export function uploadPublic(filePath) {
  const url = execFileSync('curl', [
    '-s', '-F', 'reqtype=fileupload', '-F', `fileToUpload=@${filePath}`,
    'https://catbox.moe/user/api.php',
  ], {maxBuffer: 1024 * 1024 * 50}).toString().trim();
  if (!/^https?:\/\//.test(url)) throw new Error(`upload failed: ${url}`);
  return url;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  console.log(uploadPublic(process.argv[2]));
}
