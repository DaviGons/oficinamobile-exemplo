#!/usr/bin/env bash
# Finaliza a reorganizacao do projeto (rodar UMA vez, com o Claude fechado):
#  1. junta o branch mvp-app no main (so avanca, sem merge de verdade)
#  2. traz para o main os arquivos da skill find-skills que so existem no worktree
#  3. remove o worktree .claude/worktrees/mvp-app e o branch mvp-app
#  4. move a senha do sa para ~/.config/oficinamobile/senha-sa
#  5. renomeia ~/Projects/santsystem-mobile para ~/Projects/OFICINAMOBILE
#  6. reinstala as dependencias da API e do app
# Uso: bash ~/Projects/santsystem-mobile/.claude/worktrees/mvp-app/scripts/finalizar-organizacao.sh
set -euo pipefail

ANTIGO="$HOME/Projects/santsystem-mobile"
NOVO="$HOME/Projects/OFICINAMOBILE"
WT="$ANTIGO/.claude/worktrees/mvp-app"

passo() { printf '\n==> %s\n' "$1"; }

[ -d "$ANTIGO/.git" ] || { echo "Nao achei $ANTIGO (ja foi renomeado?)"; exit 1; }
[ -e "$NOVO" ] && { echo "$NOVO ja existe; nada feito."; exit 1; }
if [ -n "$(git -C "$WT" status --porcelain --untracked-files=no)" ]; then
  echo "O worktree $WT tem alteracoes sem commit. Peça ao Claude para fazer o commit antes."; exit 1
fi

passo "Parando processos que rodam dentro do worktree (API de teste, Expo)"
# Pelo diretorio de trabalho do processo; pula este script, o terminal e o Claude
for d in /proc/[0-9]*; do
  pid="${d#/proc/}"
  [ "$pid" = "$$" ] || [ "$pid" = "$PPID" ] && continue
  dir="$(readlink "$d/cwd" 2>/dev/null)" || continue
  case "$dir" in
    "$WT"|"$WT"/*)
      nome="$(cat "$d/comm" 2>/dev/null)"
      if [ "$nome" = "claude" ]; then
        echo "  Aviso: ha um Claude aberto dentro do worktree (pid $pid). Feche ele antes."; exit 1
      fi
      kill "$pid" 2>/dev/null && echo "  parado: $pid ($nome)"
      ;;
  esac
done
sleep 1

passo "Juntando o branch mvp-app no main"
git -C "$ANTIGO" checkout -q main
if ! git -C "$ANTIGO" diff --quiet -- .gitignore; then
  git -C "$ANTIGO" add .gitignore
  git -C "$ANTIGO" commit -q -m "Ignora .claude/worktrees"
fi
git -C "$ANTIGO" merge --ff-only mvp-app 2>/dev/null || git -C "$ANTIGO" merge --no-edit mvp-app
git -C "$ANTIGO" log --oneline -1

passo "Trazendo a skill find-skills do worktree"
for item in app/.agents app/.claude/skills app/skills-lock.json; do
  if [ -e "$WT/$item" ] && [ ! -e "$ANTIGO/$item" ]; then
    mkdir -p "$(dirname "$ANTIGO/$item")"
    cp -a "$WT/$item" "$ANTIGO/$item"
    echo "  copiado: $item"
  fi
done

passo "Removendo o worktree e o branch mvp-app"
git -C "$ANTIGO" worktree remove --force "$WT"
git -C "$ANTIGO" branch -d mvp-app

passo "Senha do sa em ~/.config/oficinamobile/senha-sa"
mkdir -p "$HOME/.config/oficinamobile"
chmod 700 "$HOME/.config/oficinamobile"
if [ -f "$HOME/.config/santsystem-sa" ] && [ ! -f "$HOME/.config/oficinamobile/senha-sa" ]; then
  mv "$HOME/.config/santsystem-sa" "$HOME/.config/oficinamobile/senha-sa"
fi
[ -f "$HOME/.config/oficinamobile/senha-sa" ] && chmod 600 "$HOME/.config/oficinamobile/senha-sa"
# O .env da API do notebook fixava o caminho antigo: a API agora acha sozinha
[ -f "$ANTIGO/api/.env" ] && sed -i '/^DB_SENHA_ARQUIVO=/d' "$ANTIGO/api/.env"

passo "Renomeando para $NOVO"
mv "$ANTIGO" "$NOVO"
git -C "$NOVO" worktree prune

# Servico systemd de usuario criado antes (desativado): aponta para o lugar novo
UNIDADE="$HOME/.config/systemd/user/oficina-os-api.service"
[ -f "$UNIDADE" ] && sed -i "s#^WorkingDirectory=.*#WorkingDirectory=$NOVO/api#" "$UNIDADE"

passo "Instalando dependencias (API e app)"
(cd "$NOVO/api" && npm ci --no-audit --no-fund --loglevel=error)
(cd "$NOVO/app" && npm ci --no-audit --no-fund --loglevel=error)

passo "Pronto"
echo "Projeto: $NOVO"
echo "Abra o Claude la: cd $NOVO && claude"
