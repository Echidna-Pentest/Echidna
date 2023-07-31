#!/usr/bin/python3 -u

"""
read hydra output and output target TSV(Tab Separated Value)
"""

# [Echidna]
# pattern: hydra *
# pattern: sudo hydra *
# name: Hydra is a parallelized login cracker which supports numerous protocols to attack. 
# template: hydra {host} -l user -P $passwordfile$
# template: hydra {ipv4} -l user -P $passwordfile$
# template: hydra {ipv6} -l user -P $passwordfile$
# template: hydra {host} -l user -P $passwordfile$ {port.name}
# template: hydra {ipv4} -l user -P $passwordfile$ {port.name}
# template: hydra {ipv6} -l user -P $passwordfile$ {port.name}
# template: hydra {host} -L $userfile$ -P $passwordfile$
# template: hydra {ipv4} -L $userfile$ -P $passwordfile$
# template: hydra {ipv6} -L $userfile$ -P $passwordfile$
# template: hydra {host} -L $userfile$ -P $passwordfile$ {port.name}
# template: hydra {ipv4} -L $userfile$ -P $passwordfile$ {port.name}
# template: hydra {ipv6} -L $userfile$ -P $passwordfile$ {port.name}
# template: hydra {host} -l user -e nsr
# template: hydra {ipv4} -l user -e nsr
# template: hydra {ipv6} -l user -e nsr
# template: hydra {host} -l user -e nsr {port.name}
# template: hydra {ipv4} -l user -e nsr {port.name}
# template: hydra {ipv6} -l user -e nsr {port.name}
# template: hydra {host} -L $userfile$ -e nsr
# template: hydra {ipv4} -L $userfile$ -e nsr
# template: hydra {ipv6} -L $userfile$ -e nsr
# template: hydra {host} -L $userfile$ -e nsr {port.name}
# template: hydra {ipv4} -L $userfile$ -e nsr {port.name}
# template: hydra {ipv6} -L $userfile$ -e nsr {port.name}
# condition: {".*": ["ftp", "ssh", "http", "RDP", "21", "22", "80", "3389"]}
# group: Bruteforce attack (hydra)
# [end]

import sys
import re
from lib_command import LinesReader, type_address

SCANRESULT = re.compile(r'.*\[(\S+)\].*\[(\S+)\].*host: (\S+).*login: (\S+).*password: (\S+).*')
# DATA = re.compile(r'.*host:.*(\S+).*login:.*(\S+).*password:.*(\S+).*')
log = open('/dev/null', 'w')


def main(stream):
    for target in targets(LinesReader(stream)):
        print('remote', *target, sep='\t')
#        debug.close()


def targets(lines):
    while (match := lines.search(SCANRESULT)):
        port = match[1]
#        print(match[0])
#        protocol = match[2]
        targethostname = match[3]
        host = type_address(targethostname)
        username = match[4]
        password = match[5]
#        print(username + "/" + password, file=debug)
        if host:
            yield *host, "port", f'{port}', 'user', username
            yield *host, "port", f'{port}', 'user', username, 'pass', password


if __name__ == '__main__':
    main(sys.stdin)
