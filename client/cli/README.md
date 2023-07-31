## Requirements

This clients requires a Node.js environment.
Please install Node.js to get instration guide from the internet.

## How to install

1. clone this repository
2. cd echidna/client
3. npm install

## How to use

```
Usage: echdna [options] [command]

A client of the red team tools Echidna

Options:
  -s, --host <host>                         server name or address (default: "localhost")
  -p, --port <port>                         REST API port number (default: 8888)
  -w, --websocket <port>                    notify websocket port number (default: 8889)
  -h, --help                                display help for command

Commands:
  list                                      show terminal number and name
  logs <terminal_number>                    show logs of specified terminal
  create <terminal_name>                    create new terminal and connect
  connect <terminal_number>                 connect existing terminal
  rename <terminal_number> <terminal_name>  rename a terminal
  targets                                   show targets
  help [command]                            display help for command
```

1. Show terminal list

```
$ node echidna.js -s SERVER_ADDRESS list
```

2. Connect a terminal

```
$ node echidna.js -s SERVER_ADDRESS connect TERMINAL_NUMBER
```

3. Or create a terminal

```
$ node echidna.js -s SERVER_ADDRESS create TERMINAL_NAME
```
