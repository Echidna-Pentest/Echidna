#!/usr/bin/python3 -u

"""
exploit vsftpd 2.3.4 vulnerability
"""

# [Echidna]
# pattern: netstat -antup
# name: check network service, open port only for local network might be interesting for priv esc
# template: netstat -antup
# condition: {"currenthost": "^(?!.*default).*$"}
# group: Privilege Escalation Command
# [end]

import re
import sys
from lib_command import LinesReader, type_address

hostname = ""
SCANRESULT = re.compile(r'(tcp|tcp6|udp).*')

# DATA = re.compile(r'.*host:.*(\S+).*login:.*(\S+).*password:.*(\S+).*')
log = open('/dev/null', 'w')

def main(stream):
    for target in targets(LinesReader(stream)):
        print('remote', *target, sep='\t')
#        debug.close()


def targets(lines):
    host = type_address(hostname)
    while (match := lines.search(SCANRESULT)):
#        print(match[0])
    #            yield *host, "service", f'{port}/tcp', 'cred', username+"/"+password
#            yield *host, "service", f'{port}/tcp', 'user', username
#            yield *host, "service", f'{port}/tcp', 'pass', password
            yield *host, "local", "network", match[0]


if __name__ == '__main__':
    args = sys.argv
    hostname = args[1]
    try:
        main(sys.stdin)
    except:
        print('error', file=log)
