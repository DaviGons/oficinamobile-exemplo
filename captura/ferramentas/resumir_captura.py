"""Resume uma captura do MDIPAF: so as gravacoes, com a tabela de cada cursor.

Uso: python3 -I resumir_captura.py captura.txt
A captura vem do sqlcmd com -s '|' (hora|pc|programa|sessao|linhas|texto).
"""
import re
import sys

INICIO = re.compile(r'^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d{3})\|([^|]*)\|([^|]*)\|(\d+)\|(-?\d*)\|(.*)$')
ABRE = re.compile(r"set @p1=(\d+).*?exec sp_cursoropen @p1 output,N'(.*?)',@p3", re.S)
PREP = re.compile(r"exec sp_cursorprepexec .*?N'(.*?)',", re.S)
CURSOR = re.compile(r'^exec sp_cursor (\d+),(\d+),(\d+)(.*)$', re.S)
GRAVA = re.compile(r'^\s*(insert|update|delete|merge)\b', re.I)
IGNORAR_LINHA = ('OFFSET|',)
IGNORAR = ("configsis where busca = 'versao'", "update configsis set cp5 = '0' where busca = 'versao'")
# sp_cursor optype: 1 update, 2 delete, 4 insert (+32 = setposition)
OPS = {1: 'UPDATE', 2: 'DELETE', 4: 'INSERT'}


def eventos(caminho):
    atual = None
    with open(caminho, encoding='utf-8', errors='replace') as f:
        for linha in f:
            linha = linha.rstrip('\r\n')
            m = INICIO.match(linha)
            if m:
                if atual:
                    yield atual
                atual = list(m.groups())
            elif atual and not linha.startswith(IGNORAR_LINHA):
                atual[5] += '\n' + linha
    if atual:
        yield atual


def main(caminho, curto=False):
    cursores = {}
    for hora, pc, prog, sessao, linhas, texto in eventos(caminho):
        t = texto.strip()
        baixo = t.lower()
        if any(i in baixo for i in IGNORAR):
            continue
        m = ABRE.search(t)
        if m:
            sql = m.group(2).replace("''", "'")
            cursores[m.group(1)] = sql
            continue
        m = CURSOR.match(t)
        if m:
            op = int(m.group(2)) & 7
            if op in OPS:
                tabela = cursores.get(m.group(1), '?')
                if curto:
                    print(f'{hora[11:19]} {OPS[op]} [{tabela[:70]}] {m.group(4).strip()[:220]}')
                else:
                    print(f'{hora[11:19]} s{sessao} {OPS[op]} via cursor [{tabela[:120]}]\n    {m.group(4).strip()[:1500]}')
            continue
        if GRAVA.match(t):
            if curto:
                print(f'{hora[11:19]} SQL ({linhas}) ' + ' '.join(t.split())[:260])
            else:
                print(f'{hora[11:19]} s{sessao} SQL ({linhas} linhas)\n    {t[:1500]}')


if __name__ == '__main__':
    main(sys.argv[1], curto='--curto' in sys.argv[2:])
