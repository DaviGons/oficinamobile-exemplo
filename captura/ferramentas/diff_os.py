"""Mostra o que mudou entre salvamentos de uma OS (cabecalho, pecas e servicos).

Uso: python3 -I diff_os.py resumo-completo.txt <id_os>
"""
import re
import sys

CAMPO = re.compile(r"@(\w+)=('(?:[^']|'')*'|[^,]*)")
SERV = re.compile(r"(\w+) = ('(?:[^']|'')*')")


def main(caminho, os_id):
    linhas = open(caminho, encoding='utf-8').read().split('\n')
    ultimo = {}
    for i, l in enumerate(linhas):
        if i + 1 >= len(linhas):
            break
        prox = linhas[i + 1]
        chave = None
        if f"PedVendaCab WHERE ID = '{os_id}'" in l:
            chave = 'cabecalho'
        elif "PedVendaProd WHERE ID = '" in l and f"@ChvPed='{os_id}'" in prox:
            chave = 'peca ' + l.split("WHERE ID = '")[1].split("'")[0]
        elif l.endswith('SQL (1 linhas)') and 'Servicos_OS' in prox and f"Id_Venda = '{os_id}'" in prox:
            chave = 'servico ' + prox.rsplit("id = '", 1)[-1].strip(" '")
        if not chave:
            continue
        campos = dict(CAMPO.findall(prox)) if not chave.startswith('servico') else dict(SERV.findall(prox))
        ant = ultimo.get(chave)
        if ant is not None:
            dif = {k: f'{ant.get(k)} -> {v}' for k, v in campos.items() if ant.get(k) != v}
            if dif:
                print(l[:8], chave, dif)
        ultimo[chave] = campos


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
