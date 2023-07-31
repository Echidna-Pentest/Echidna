#!/usr/bin/python3 -u

# [Echidna]
# name: DIRB is a Web Content Scanners, it can discover hidden files and directories on a web server by brute forcing the directory names.
# template: dirb http://{host}/  -S
# template: dirb https://{host}/ -S
# template: dirb http://{ipv4}/ -S
# template: dirb https://{ipv4}/ -S
# template: dirb http://{ipv6}/ -S
# template: dirb https://{ipv6}/ -S
# template: dirb http://{host}:{port}/  -S
# template: dirb https://{host}:{port}/ -S
# template: dirb http://{ipv4}:{port}/ -S
# template: dirb https://{ipv4}:{port}/ -S
# template: dirb http://{ipv6}:{port}/ -S
# template: dirb https://{ipv6}:{port}/ -S
# template: dirb {url} -S
# name: Append each word with .php by -X option.
# template: dirb http://{host}/  -S -X .php
# template: dirb https://{host}/ -S -X .php
# template: dirb http://{ipv4}/ -S -X .php
# template: dirb https://{ipv4}/ -S -X .php
# template: dirb http://{ipv6}/ -S -X .php
# template: dirb https://{ipv6}/ -S -X .php
# template: dirb http://{host}:{port}/  -S -X .php
# template: dirb https://{host}:{port}/ -S -X .php
# template: dirb http://{ipv4}:{port}/ -S -X .php
# template: dirb https://{ipv4}:{port}/ -S -X .php
# template: dirb http://{ipv6}:{port}/ -S -X .php
# template: dirb https://{ipv6}:{port}/ -S -X .php
# template: dirb {url} -S -X .php
# pattern: dirb\s+(-.+\s+)*http
# condition: {".*": ["80", "443", "http", "https"]}
# group: HTTP
# [end]

import sys
import re
from lib_command import LinesReader, type_address

URL_BASE = re.compile(r'URL_BASE: (https?)://(\S+)/\S*')

log = open('/dev/null', 'w')

def main(lines):
    for target in urls(LinesReader(lines)):
        print('remote', *target, sep='\t')


def urls(lines):
    host = ""
    port = ""
    if match := lines.search(URL_BASE):
        if match[2]:
            host = match[2]
        if (":" in host):
            host, port = host.split(":")[0], host.split(":")[1]
        elif (match[1] == "https"):
            port = "443"
        else:
            port = "80"
    host = type_address(host)
    for line in lines:
        if not line.isspace():
            url = line.strip()
            yield *host, 'port', f'{port}', 'url', url


if __name__ == '__main__':
    try:
        main(sys.stdin)
    except:
        print('error', file=log)
