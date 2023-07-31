#!/usr/bin/python3 -u


# [Echidna]
# pattern: uname *
# name: check kernel version which is important for privesc
# template: uname -a
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
        if not line.isspace():
            l = line.split()
            yield *host, "local", "uname_result", "OS", l[0]
            yield *host, "local", "uname_result", "hostname", l[1]
            yield *host, "local", "uname_result", "version", l[2]


if __name__ == '__main__':
    args = sys.argv
    hostname = args[1]
    try:
        main(sys.stdin)
    except:
        print('error', file=log)
