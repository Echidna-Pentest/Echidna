#!/usr/bin/python3 -u


# [Echidna]
# pattern: cat /etc/passwd
# pattern: cat /etc/redhat-release
# pattern: cat /etc/os-release
# name: read data from the file which is important for privesc
# template: cat /etc/passwd | grep -v nologin
# template: cat /etc/redhat-release
# template: cat /etc/os-release
# condition: {"currenthost": "^(?!.*default).*$"}
# group: Privilege Escalation Command
# [end]

import re
import sys
from lib_command import LinesReader, type_address


hostname = ""
filename = ""
# SCANRESULT = re.compile(r'.*:.*:.*:.*.*:.*:.*')

# DATA = re.compile(r'.*host:.*(\S+).*login:.*(\S+).*password:.*(\S+).*')
log = open('/dev/null', 'w')

def main(stream):
    for target in targets(LinesReader(stream)):
        print('remote', *target, sep='\t')
#        debug.close()


def targets(lines):
    host = type_address(hostname)
    for line in lines:
        if not line.isspace():
            if (filename == "/etc/redhat-release"):
                yield *host, "local", "version", line
            elif (filename == "/etc/os-release"):
                if "PRETTY_NAME=" in line:
                    yield *host, "local", "version", line.split("PRETTY_NAME=")[1].replace('"', '')
            else:
                yield *host, "local", filename, line


if __name__ == '__main__':
    args = sys.argv
    hostname = args[1]
    commandLine = args[2]
    filename = commandLine.split(' ')[1]
    try:
        main(sys.stdin)
    except:
        print('error', file=log)
