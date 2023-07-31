#!/usr/bin/python3 -u

"""
read wpscan output and output target TSV(Tab Separated Value)
"""

# [Echidna]
# name: wordpress vulnerability scan by wpscan
# template: wpscan --url http://{host}/  -f cli-no-colour
# template: wpscan --url http://{ipv4}/ -f cli-no-colour
# template: wpscan --url {url} -f cli-no-colour
# template: wpscan --url http://{host}/  -f cli-no-colour -e at -e ap -e u
# template: wpscan --url http://{ipv4}/ -f cli-no-colour -e at -e ap -e u
# template: wpscan --url {url} -f cli-no-colour -e at -e ap -e u
# template: wpscan --url http://{host}/ -f cli-no-colour -U $username$ -P $passwordfile$ --force
# template: wpscan --url http://{ipv4}/ -f cli-no-colour -U $username$ -P $passwordfile$ --force
# template: wpscan --url {url} -f cli-no-colour -U $username$ -P $passwordfile$ --force
# pattern: wpscan --url .*
# pattern: sudo wpscan --url .*
# condition: {".*": ["80", "443", "http", "https"]}
# group: HTTP
# [end]

import sys
import re
from urllib.parse import urlparse
from lib_command import LinesReader, type_address


PLUS_ITEM = re.compile(r'(\[\+\]\S+)')
SCAN_DETAILS = re.compile(r'^\s|\s')
# URL_LINE = re.compile(r'\[\+\].*URL: (https?://\S+)')
URL_LINE = re.compile(r'\[\+\].*URL: (https?://\S+/\S*).*\[\S+\]')

log = open('/dev/null', 'w')


def main(lines):
    for target in scanresults(LinesReader(lines)):
        print('remote', *target, sep='\t',  end='')
        continue


def find_url(lines):
    if (match := lines.search(URL_LINE)):
        url = match[1]
        target = urlparse(url)
        host = type_address(target.hostname)
        port = target.port or 80
        return host, port


def scanresults(lines):
    while lines:
        host, port = find_url(lines)
        for line in lines:
            print('line:', line, file=log)
            plusitem = line
            isFirst = True
            while lines and lines.fetch()[:2] == ' |':
                if isFirst:     # yield plus item
                    yield *host, "port", f'{port}', 'wp-scan', plusitem
                    isFirst = False
                scandetails = lines.fetch()
                next(lines)
                yield(*host, "port", f'{port}',
                      'wp-scan', plusitem.rstrip('\r\n'), scandetails)


if __name__ == '__main__':
    try:
        main(sys.stdin)
    except:
        print('error', file=log)
