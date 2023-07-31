## Requirements

This clients requires a Node.js environment.
Please install Node.js to get instration guide from the internet.

For Kali Linux:

```
$ sudo apt-get -y update
$ sudo apt-get -y dist-upgrade
$ sudo apt-get -y install kali-linux-headless nodejs npm
$ sudo npm install n -g
$ sudo n node/16.17.0
$ sudo apt-get -y purge nodejs npm
$ sudo apt-get -y autoremove
$ sudo apt-get clean
```

## How to install

1. clone this repository
2. execute commands below:

```
$ cd echidna/EchidnaServer
$ npm install
```

## How to start

```
$ npm start
```

## Functioal structure

```
+----------+  +----------+  +----------+
| client#1 |  | client#1 |  | client#1 |
+---+------+  +-------+--+  +-----+----+
    | remote connect  |           |
    v                 v           v
+-----------------------------------------------------+
| Echidna Server: share resoureces                    |
|                                        +----------+ |
| +-------------+     +--------------+   |candidate | |
| | terminal#1  | ... | terminal#n   |   |commands  | |
| +-----+-------+     +------+-------+   +----------+ |
|       |execute             |execute         ^       |
|       v                    v                |pickup |
| +-------------+     +--------------+   +----+-----+ |
| |local shell#1| ... |remote shell#n|   | targets  | |
| +-----+-------+     +--------------+   +----------+ |
|       |execute             ^                ^       |
|       v                    |                |filter |
| +-------------+ output     |         +------+-----+ |
| |   command   +------------|-------->|command logs| |
| +-----+-------+            |         +------------+ |
|       |                    |                ^       |
+-------|--------------------|----------------|-------+
        |penetrate           |connect         |output
+-------|--------------------|----------------|-------+
|       |     Targeted host  |                |       |
|       v                    |                |       |
| +------------+         +---+-----+ execute  |       |
| | Vulnerable | execute | Reverse |      +---------+ |
| | Service    |-------->| Shell   +----->| command | |
| +------------+         +---------+      +---------+ |
+-----------------------------------------------------+
```
