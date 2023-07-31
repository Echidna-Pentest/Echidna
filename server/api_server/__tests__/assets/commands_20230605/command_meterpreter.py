#!/usr/bin/python3 -u

"""
exploit vsftpd 2.3.4 vulnerability
"""

# [Echidna]
# pattern: python *42315.py*
# name: meterpreter shell command
# template: getsystem
# template: getprivs
# template: hashdump
# template: getuid
# template: sysinfo
# template: load kiwi
# template: creds_all
# condition: {"currenthost": "^(?!.*default).*$", "currentcommand": "meterpreter"}
# group: Meterpreter Command
# [end]


import sys
import re
from lib_command import LinesReader, type_address

HEADER = re.compile(r'\[\+\].*IP: (\S+):(\S+).*Name: (\S+)')
log = open('/dev/null', 'w')

def main(lines):
    for line in lines:
        print('line:', line, file=log)


if __name__ == '__main__':
    try:
        main(sys.stdin)
    except:
        print('error', file=log)
