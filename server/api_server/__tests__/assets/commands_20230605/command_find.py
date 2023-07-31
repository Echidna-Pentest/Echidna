#!/usr/bin/python3 -u


# [Echidna]
# pattern: find / -perm -u=s -type f 2 *
# name: find out files which have the SUID bit set
# template: find / -perm -u=s -type f 2>/dev/null
# condition: {"currenthost": "^(?!.*default).*$"}
# group: Privilege Escalation Command
# [end]

import re
import sys
from lib_command import LinesReader, type_address


hostname = ""
log = open('/dev/null', 'w')


def main(stream):
    for target in targets(LinesReader(stream)):
        print('remote', *target, sep='\t')
#        debug.close()


def targets(lines):
    host = type_address(hostname)
    for line in lines: 
#        print(line)
            yield *host, "local", "suidfile", line


if __name__ == '__main__':
    args = sys.argv
    hostname = args[1]
    try:
        main(sys.stdin)
    except:
        print('error', file=log)
