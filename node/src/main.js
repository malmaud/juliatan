import express from 'express'
import bodyParser from 'body-parser'
import zmq from 'zmq'
import r from 'rethinkdb'
import request_lib from 'request'

let app = express()
let socket = null
let connection = null
let timeout_duration = 2000  // In milliseconds
let msg_id = 0
let response_map = {}
let response_urls = {}

async function db_connect() {
  connection = await r.connect({host: 'db'})
  let tables = await r.tableList().run(connection)
  if (tables.indexOf('requests') == -1) {
    r.tableCreate('requests').run(connection)
  }
  if (tables.indexOf('responses') == -1) {
    r.tableCreate('responses').run(connection)
  }
}

db_connect()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))

app.get('/', (req, res) => {
  res.send('juliatan is very much active')
})

function send_json(res, d) {
  res.set('Content-Type', 'application/json')
  res.send(JSON.stringify(d))
}

function process_message(msg) {
  let backend_msg = JSON.parse(msg.toString())
  console.log(`Processing message ${msg.toString()}`)
  let msg_id = backend_msg["message_id"]
  let node_response
  let response_kind
  if (msg_id in response_map) {
    node_response = response_map[msg_id]
    delete response_map[msg_id]
    response_kind = "immediate"
  } else {
    response_kind = "delayed"
  }
  console.log(`response kind is ${response_kind}`)
  let result
  if (backend_msg['result'] === null) {
    result = 'nothing'
  } else {
    result = backend_msg['result'].toString()
  }
  let slack_msg = {attachments: []}
  if (backend_msg["kind"] == "error") {
    let attachment = {title: 'Error',
                      color: 'warning',
                      text: result}
    slack_msg['attachments'].push(attachment)
  } else {
    let attachment = {title: 'Result',
                      text: result,
                      color: 'good'}
    slack_msg['attachments'].push(attachment)
  }
  let type_field = {title: 'Type',
                    value: backend_msg['type']}
  slack_msg['attachments'][0]['fields'] = [type_field]
  if (backend_msg['stdout'].length > 0) {
    let attachment = {title: 'Output',
                      text: backend_msg['stdout'],
                      color: '#764FA5'}
    slack_msg['attachments'].push(attachment)
  }
  slack_msg['response_type'] = 'in_channel'
  r.table('responses').insert(slack_msg).run(connection)
  if (response_kind == "immediate") {
    send_json(node_response, slack_msg)
  } else if (response_kind == "delayed") {
    let options = {
      url: response_urls[msg_id],
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(slack_msg)
    }
    request_lib(options)
  }
}

app.post('/slack', async (req, res) => {
  let cur_msg_id = msg_id
  response_map[msg_id] = res
  response_urls[msg_id] = req.body.response_url
  let got_msg = false
  req.body['message_id'] = msg_id
  r.table('requests').insert(req.body).run(connection)

  let onTimeout = ()=>{
    if (cur_msg_id in response_map) {
      delete response_map[cur_msg_id]
      let msg = {}
      let attachment = {title: 'Juliatan is delayed',
                        text: 'No response received within 2 seconds',
                        color: 'danger'}
      msg['attachments'] = [attachment]
      msg['response_type'] = 'in_channel'
      send_json(res, msg)
      make_socket()
    }
  }
  setTimeout(onTimeout, timeout_duration)
  let backend_request = {code: req.body.text, message_id: msg_id}
  msg_id += 1
  socket.send(JSON.stringify(backend_request))
})

function make_socket() {
  socket = zmq.socket('dealer')
  socket.on('message', msg=>{
    process_message(msg)
  })
  socket.connect('tcp://backend_julia5:10000')
}

app.listen(3000, ()=>{
  console.log('Listening')
  make_socket()
})
