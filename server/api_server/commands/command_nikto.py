#!/usr/bin/python3 -u

"""
read nikto output and output target TSV(Tab Separated Value)
"""

# [Echidna]
# name:  nikto is used to scan a web-server for the vulnerability that can be exploited and can compromise the server. 
# pattern: nikto -h .*
# pattern: sudo nikto -h .*
# template: nikto -h http://{host}/
# template: nikto -h http://{ipv4}/
# template: nikto -h http://{ipv6}/
# template: nikto -h http://{host}:{port}/
# template: nikto -h http://{ipv4}:{port}/
# template: nikto -h http://{ipv6}:{port}/
# template: nikto -h {url}
# condition: {".*": ["80", "443", "http", "https"]}
# group: HTTP
# [end]

import sys
import re
from lib_command import LinesReader, type_address


SCAN_RESULTS = re.compile(r'^\+')
START_TIME = re.compile(r'^\+ Start Time:')
END_TIME = re.compile(r'^\+ End Time:')
TARGET_IP = re.compile(r'Target IP:\s*(\S+)')
TARGET_HOSTNAME = re.compile(r'Target Hostname:\s*(\S+)')
TARGET_PORT = re.compile(r'Target Port:\s*(\S+)')
log = open('/dev/null', 'w')


def main(lines):
    for target in scanresults(LinesReader(lines)):
        print('remote', *target, sep='\t',  end='')
        continue


def scanresults(lines):
    while lines:
        for line in lines:
            print('line:', line, file=log)
            # read header data (Target IP, Target Hostname, Target Port)
            if (match := TARGET_IP.search(line)):
                continue
            elif (match := TARGET_HOSTNAME.search(line)):
                targethostname = match[1]
                host = type_address(targethostname)
                continue
            elif (match := TARGET_PORT.search(line)):
                targetport = match[1]
                continue
            elif (match := START_TIME.search(line)):
                continue

            # read scan results
            if not (match := SCAN_RESULTS.search(line)):
                continue
            if (match := END_TIME.search(line)):
                break
#            if '\n' not in line:
#                line = line + '\n'
            yield *host, 'port', targetport, 'nikto-vuln', line


if __name__ == '__main__':
    try:
        main(sys.stdin)
    except:
        print('error', file=log)
