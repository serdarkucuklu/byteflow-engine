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

# Rebase ORTASINDA kalan çakışmaları deterministik bir kuralla kapat.
#
# ⚠ 2026-08-03 CANLI HATA: `-X theirs` ikili dosyayı çözüyor ama MODIFY/DELETE çakışmasını
# ÇÖZMÜYOR. Marka yeniden adlandırılırken eski slug'ın durum dosyaları master'da silindi;
# o sırada koşan iş ise eski checkout'uyla aynı dosyaları commit'lemişti. Rebase
# modify/delete'e düştü, script teslim oldu ve ÜRETİLMİŞ VİDEO push edilemediği için onaya
# hiç düşemedi — yani Gemini + TTS kotası harcandıktan SONRA kaybedildi.
#
# Kural: dosyayı yukarı akış (master) SİLDİYSE silme kazanır — silme kasıtlıdır, geri
# diriltmek ölü marka dosyalarını sürekli geri getirir. Diğer her çakışmada BİZİM
# sürümümüz kazanır (bu koşunun ürettiği taze içerik).
cakismalari_coz() {
  local f
  git diff --name-only --diff-filter=U | while read -r f; do
    if git cat-file -e HEAD:"$f" 2>/dev/null; then
      git add -- "$f"                       # iki taraf da değiştirdi → bizimki (-X theirs) kalsın
    else
      git rm -q --force -- "$f" 2>/dev/null || git rm -q --cached --force -- "$f"
      echo "· yukarı akış silmiş, silme kabul edildi: $f" >&2
    fi
  done
}

for i in 1 2 3; do
  if git push >&2; then break; fi
  echo "· push reddedildi, rebase ile tekrar (deneme $i)" >&2
  if ! git pull --rebase -X theirs --autostash origin master >&2; then
    # Rebase yarıda kaldıysa çakışmaları kapatıp devam et; kapatamazsak temiz vazgeç.
    if [ -d "$(git rev-parse --git-path rebase-merge)" ] || [ -d "$(git rev-parse --git-path rebase-apply)" ]; then
      cakismalari_coz
      if ! GIT_EDITOR=true git rebase --continue >&2; then
        echo "✖ rebase çakışması çözülemedi — vazgeçiliyor" >&2
        git rebase --abort >&2 || true
        exit 1
      fi
    else
      exit 1
    fi
  fi
  sleep 3
done

git rev-parse HEAD
