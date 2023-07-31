#!/usr/bin/python3 -u

"""
read nmap output and output target TSV(Tab Separated Value)
"""

# [Echidna]
# pattern: nmap .*
# pattern: sudo nmap .*
# name: scan welknown ports using nmap
# template: nmap {host}
# template: nmap {ipv4}
# template: nmap {ipv6}
# name: scan all ports using nmap
# template: nmap -Pn -p- {host}
# template: nmap -Pn -p- {ipv4}
# template: nmap -Pn -p- {ipv6}
# name: -A option enables OS detection, version detection, script scanning, and traceroute
# template: nmap -Pn -sV -A -p{port} {host}
# template: nmap -Pn -sV -A -p{port} {ipv4}
# template: nmap -Pn -sV -A -p{port} {ipv6}
# name: scan vulnerabiliities using nmap
# template: nmap -Pn -sV -script vuln -p{port} {host}
# template: nmap -Pn -sV -script vuln -p{port} {ipv4}
# template: nmap -Pn -sV -script vuln -p{port} {ipv6}
# name: aggressive scan using nmap
# template: nmap -Pn -A -Pn -T4 {host}
# template: nmap -Pn -A -Pn -T4 {ipv4}
# template: nmap -Pn -A -Pn -T4 {ipv6}
# [end]


import sys
import re
from lib_command import LinesReader, type_address

HOST = re.compile('^Nmap scan report for (\S+)(\([^\)]*\))?')


def main(stream):
    for target in targets(LinesReader(stream)):
        print('remote', *target, sep='\t')


def targets(lines):
    host = find_host(lines)
    skip_to_port_header(lines)
    for port in ports(lines):
        yield *host, *port


def find_host(lines):
    if match := lines.search(HOST):
        if match[2]:
            return 'host', match[1], *type_address(match[2])
        else:
            return type_address(match[1])
    else:
        return 'host', 'unknown'


def skip_to_port_header(lines):
    lines.find(lambda line: line.split()[:3] == ['PORT', 'STATE', 'SERVICE'])


def ports(lines):
    while lines:
        if not lines.fetch()[:1].isdigit():
            break
        line = next(lines)
        service, state, *name = line.split(maxsplit=2)
        port, *protocol = service.split('/', maxsplit=1)
#        yield 'port', port
#        service = ['service', service]
        if ("udp" in service):
            service = ['port-udp', service.split("/")[0]]
        else:
            service = ['port', service.split("/")[0]]
        if name:
            name, *version = name[0].split(maxsplit=1)
            yield *service, 'name', name
            if version:
                yield *service, 'version', *version
        else:
            yield service
        for detail in port_details(lines):
            yield *service, *detail


def port_details(lines):
    if lines.fetch()[:1] == '|':
        while lines and lines.fetch()[:1] == '|':
            for vulner in vulners(lines):
                yield vulner
            for detail in vuln_details(lines):
                yield detail
            # if lines.fetch().startswith('|_'):
            #     next(lines)
            # elif lines.fetch().startswith('| '):
            #     name = next(lines)[2:-1].strip()
            #     while lines:
            #         line = next(lines)
            #         yield name, line[2:].strip()
            #         if line.startswith('|_'):
            #             break
    elif lines.fetch()[:1].isdigit():
        return
    else:
        for line in lines:
            if "Host script results:" in line:
                while lines and lines.fetch()[:1] == '|':
                    for detail in vuln_details(lines):
                        yield detail
            elif line == '\n':
                continue
            else:
                yield "info", line.strip()
#                print(line)

def vuln_details(lines):
    if lines.fetch().startswith('|_'):
        line = next(lines)
        if ':' in line:
            parts = line.split(":")
            yield(parts[0].strip()[2:]+":", parts[1])
    elif lines.fetch().startswith('| '):
        name = next(lines)[2:-1].strip()
        while lines:
            line = next(lines)
            yield name, line[2:].strip()
            if line.startswith('|_'):
                break


def vulners(lines):
    if not lines.fetch().startswith('| vulners:'):
        return
    next(lines)
    platform = next(lines)[2:-1].strip().rstrip(':')
    while lines.fetch().startswith('|  '):
        line = next(lines)
        yield 'platform', platform, 'vulner', line[2:-1].strip().replace('\t', ' ')
        if lines.fetch().startswith('|_'):
            break


if __name__ == '__main__':
    main(sys.stdin)
