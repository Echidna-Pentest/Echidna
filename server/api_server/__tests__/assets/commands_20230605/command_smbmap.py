#!/usr/bin/python3 -u

"""
read smbmap output and output target TSV(Tab Separated Value)
"""

# [Echidna]
# pattern: smbmap -H .*
# pattern: sudo smbmap -H .*
# name: scan shared drive via SMB using smbmap
# template: smbmap -H {host}
# template: smbmap -H {ipv4}
# template: smbmap -H {ipv6}
# condition: {".*": ["139", "445", "netbios", "microsoft-ds"]}
# group: SMB
# [end]

import sys
import re
from urllib.parse import urlparse
from lib_command import LinesReader, type_address

HEADER = re.compile(r'\[\+\].*IP: (\S+):(\S+).*Name: (\S+)')
log = open('/dev/null', 'w')


def main(stream):
    for target in targets(LinesReader(stream)):
        print('remote', *target, sep='\t', end='')


def find_host(lines):
    if (match := lines.search(HEADER)):
        ip = match[1]
        host = type_address(ip)
        target = urlparse(ip)
        port = target.port or 445
        next(lines)  # skip 2 lines since line after header is no useful data
        next(lines)
        return host, port


def targets(lines):
    while lines:
        host, port = find_host(lines)
        count = 0
        for line in lines:
            print('line:', line, file=log)
            # read header data
            # yield scan results
            if (line == '\n'):
                break
#            scandetails = re.sub('\s{2,}|\t', '| ', line)
            scandetails = re.split('\s{2,}|\t', line)
            if '\n' not in scandetails[3]:
                scandetails[3] = scandetails[3] + '\n'
            tmp = str(count)
            yield *host, "port", f'{port}', 'SMBDrive', scandetails[1]+ '\n'
            yield *host, "port", f'{port}', 'SMBperm', tmp+scandetails[2] + '\n'
            yield *host, "port", f'{port}', 'SMBcomment', tmp+scandetails[3] 
            count = count + 1

if __name__ == '__main__':
    main(sys.stdin)
