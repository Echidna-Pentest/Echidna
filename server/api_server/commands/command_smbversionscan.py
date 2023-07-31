#!/usr/bin/python3 -u

"""
Scan smb version detection and output target TSV(Tab Separated Value)
"""

# [Echidna]
# pattern: auxiliary/scanner/smb/smb_version
# name: Scan smb version via metasploit module
# template: msfconsole -x "use auxiliary/scanner/smb/smb_version; set rhosts {ipv4}; exploit"
# template: msfconsole -x "use auxiliary/scanner/smb/smb_version; set rhosts {host}; exploit"
# condition: {".*": ["139", "445", "netbios", "microsoft-ds"]}
# group: SMB
# [end]

import sys
import re
from urllib.parse import urlparse
from lib_command import LinesReader, type_address

log = open('/dev/null', 'w')
IP_PORT = re.compile(r'([0-9]+(?:\.[0-9]+){3}):([0-9]+)')
VERSION = re.compile('(Samba \S+)\\)')

def main(lines):
    for target in targets(LinesReader(lines)):
        print('remote', *target, sep='\t', end='')


def targets(lines):
    host = ""
    port = ""
    version = ""
    if (match := lines.search(IP_PORT)):
        host = match[1]
        port = match[2]
        host = type_address(host)
    if (match := lines.search(VERSION)):
        version = match[1]
        yield(*host, "port", f'{port}', 'version\n')
        yield(*host, "port", f'{port}', 'version', version+"\n")


if __name__ == '__main__':
    main(sys.stdin)
