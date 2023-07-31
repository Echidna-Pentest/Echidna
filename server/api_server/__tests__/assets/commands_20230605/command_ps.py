#!/usr/bin/python3 -u


# [Echidna]
# pattern: ps aux | grep root
# name: enumerate root process
# template: ps aux | grep root
# condition: {"currenthost": "^(?!.*default).*$"}
# group: Privilege Escalation Command
# [end]

import re
import sys
from lib_command import LinesReader, type_address

hostname = ""
#COMMAND = re.compile('\d{1,2}:\d{1,2}\s[^(\d{1,2}:\d{1,2})](.*)$')
#COMMAND = re.compile('\d{1,2}:\d{1,2}\s([^\d{1,2}:\d{1,2}]*)$')
#COMMAND = re.compile('(\d{1,2}:\d{1,2}\s+){2}(.*)$')
#COMMAND = re.compile('(\d{1,2}:\d{1,2}\s+)(.*)$')
COMMAND = re.compile('(\d{1,2}:\d{1,2}\s+)(.*)$')
#COMMAND = re.compile('(\d{1,2}:\d{1,2}\s)[^(\d{1,2}:\d{1,2}\s)](.*)$')


# DATA = re.compile(r'.*host:.*(\S+).*login:.*(\S+).*password:.*(\S+).*')
log = open('/dev/null', 'w')

def main(stream):
    for target in targets(LinesReader(stream)):
        print('remote', *target, sep='\t')
#        debug.close()


def targets(lines):
    host = type_address(hostname)
    while lines:
        if (match := lines.search(COMMAND)):
            yield *host, "local", "rootprocess", match[2]


if __name__ == '__main__':
    args = sys.argv
    hostname = args[1]
    try:
        main(sys.stdin)
    except:
        print('error', file=log)

