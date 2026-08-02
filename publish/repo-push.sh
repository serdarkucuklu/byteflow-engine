#!/usr/bin/env bash
# Üretilen dosyaları repoya it ve SONUÇTAKİ SHA'yı yazdır (son satır = sha).
#
#   bash publish/repo-push.sh "commit mesajı" yol1 yol2 ...
#
# Neden ayrı script: aynı push mantığı hem günlük iş akışında hem de onay döngüsünde
# (tekrar denemede, koşu ORTASINDA) gerekiyor. İki kopya olsaydı biri mutlaka eskirdi.
#
# ⚠ Buradaki iki gotcha canlı yaşandı:
#  · Koşu ~8 dk sürüyor; bu arada başka bir koşu push ederse fast-forward reddediliyor ve
#    video hiç yüklenmiyordu → rebase ile 3 deneme.
#  · public/<marka>-latest.mp4 İKİLİ dosya; düz rebase "Cannot merge binary files" ile
#    düşüyordu → -X theirs (rebase'de "theirs" = yeniden uygulanan, yani BİZİM commit'imiz).
set -euo pipefail

MESAJ="${1:?commit mesajı gerekli}"
shift

git config user.name  "byteflow-bot"
git config user.email "byteflow-bot@users.noreply.github.com"

for f in "$@"; do
  if [ -e "$f" ]; then git add -f "$f"; else echo "· yok, atlandı: $f" >&2; fi
done

git commit -m "$MESAJ" >&2 || echo "değişiklik yok" >&2

for i in 1 2 3; do
  if git push >&2; then break; fi
  echo "· push reddedildi, rebase ile tekrar (deneme $i)" >&2
  git pull --rebase -X theirs --autostash origin master >&2 || exit 1
  sleep 3
done

git rev-parse HEAD
