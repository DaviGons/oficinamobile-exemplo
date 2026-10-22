#!/usr/bin/env bash
# Acompanha ao vivo as gravacoes do SantSystem (MDIPAF) na captura.
# Uso: ao_vivo.sh [<arquivo_xel_inicial> <offset_inicial>]
# Sem argumentos: le tudo uma vez sem mostrar e depois so o que for novo.
# Saida: uma linha por gravacao nova. Bruto em dados/ao-vivo-raw.txt (raiz do projeto).
ferr="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$ferr/../../dados" && cd "$ferr/../../dados" || exit 1
senha_arq="$HOME/.config/oficinamobile/senha-sa"
[ -f "$senha_arq" ] || senha_arq="$HOME/.config/santsystem-sa"
arq="$1"; off="$2"
raw=ao-vivo-raw.txt; : > "$raw"; vistos=0; calado=0
[ -z "$arq" ] && calado=1
while true; do
  SQLCMDPASSWORD="$(cat "$senha_arq")" timeout 90 sqlcmd -S 192.168.0.20,1433 -U sa -C -l 10 -W -s '|' -y 0 \
    -v PROGRAMA="N'MDIPAF'" ARQ_INI="$([ -n "$arq" ] && echo "N'$arq'" || echo NULL)" OFF_INI="${off:-NULL}" -i "$ferr/extrair_captura.sql" -o pedaco.txt 2>&1 \
    || echo "ERRO na leitura ($(date +%T)): $(head -c 300 pedaco.txt | tr '\n' ' ')"
  linha_off="$(tr -d '\r' < pedaco.txt | grep '^OFFSET|' | tail -1)"
  novo_arq="$(echo "$linha_off" | cut -d'|' -f2)"; novo_off="$(echo "$linha_off" | cut -d'|' -f3)"
  if [ -n "$novo_off" ]; then
    grep -v '^OFFSET|' pedaco.txt >> "$raw"; arq="$novo_arq"; off="$novo_off"
    python3 -I "$ferr/resumir_captura.py" "$raw" --curto > resumo.txt
    total=$(wc -l < resumo.txt)
    [ "$calado" = 0 ] && [ "$total" -gt "$vistos" ] && tail -n +"$((vistos + 1))" resumo.txt
    [ "$calado" = 1 ] && echo "($(date +%T)) acompanhamento pronto, $total gravacoes antigas ignoradas"
    calado=0
    vistos=$total
  fi
  sleep 15
done
