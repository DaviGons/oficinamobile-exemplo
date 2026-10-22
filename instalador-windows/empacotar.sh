#!/usr/bin/env bash
# Monta o pacote do OficinaMobile para o PC da oficina (Windows):
#   API (com dependencias) + pasta do Claude (claude-pc-oficina/ + docs/) + instalador
# Saida: ~/Downloads/OficinaMobile-Windows.zip
# Uso: bash instalador-windows/empacotar.sh [arquivo.zip]
set -euo pipefail
raiz="$(cd "$(dirname "$0")/.." && pwd)"
saida="${1:-$HOME/Downloads/OficinaMobile-Windows.zip}"
temp="$(mktemp -d)"
trap 'rm -rf "$temp"' EXIT
pacote="$temp/OficinaMobile"

# Instalador
mkdir -p "$pacote/api" "$pacote/claude/docs"
cp -r "$raiz/instalador-windows/scripts" "$raiz/instalador-windows/INSTALAR.cmd" \
      "$raiz/instalador-windows/DESINSTALAR.cmd" "$raiz/instalador-windows/LEIA-ME.txt" "$pacote/"

# API (so dependencias de producao, todas em JavaScript)
cp -r "$raiz/api/src" "$raiz/api/scripts" "$raiz/api/package.json" "$raiz/api/package-lock.json" "$pacote/api/"
(cd "$pacote/api" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error)
if find "$pacote/api/node_modules" -name '*.node' | grep -q .; then
  echo "ERRO: ha modulo nativo em node_modules (nao funcionaria no Windows)" >&2
  exit 1
fi

# Codigo de acesso do app (o mesmo da API do notebook, para o app nao precisar mudar)
grep '^APP_TOKEN=' "$raiz/api/.env" | cut -d= -f2 > "$pacote/api/app-token.txt"

# Pasta do Claude no PC (vira C:\OficinaOS\claude) com a documentacao do projeto
cp -r "$raiz/claude-pc-oficina/." "$pacote/claude/"
cp "$raiz"/docs/*.md "$pacote/claude/docs/"

# Quebra de linha do Windows nos scripts
for f in "$pacote"/*.cmd "$pacote"/LEIA-ME.txt "$pacote"/scripts/*.ps1 "$pacote"/claude/*.cmd "$pacote"/claude/*.ps1; do
  sed -i 's/\r$//; s/$/\r/' "$f"
done

rm -f "$saida"
(cd "$temp" && bsdtar -a -cf "$saida" OficinaMobile)
echo "Pacote: $saida ($(du -h "$saida" | cut -f1))"
