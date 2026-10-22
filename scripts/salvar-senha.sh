#!/usr/bin/env bash
# Guarda a senha do sa do SantSystem num arquivo que so o seu usuario le
# (~/.config/oficinamobile/senha-sa, usado pela API e pelos scripts do notebook).
# A senha nao aparece na tela nem fica no historico do terminal.
set -e
ARQ="$HOME/.config/oficinamobile/senha-sa"
read -rsp "Senha do sa (nao aparece enquanto digita): " SENHA
echo
umask 077
mkdir -p "$(dirname "$ARQ")"
printf '%s' "$SENHA" > "$ARQ"
chmod 600 "$ARQ"
echo "Senha salva. Pode voltar para o Claude."
