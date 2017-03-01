using ZMQ
using JSON

ctx = Context()

function get_socket()
    client = Socket(ctx, REQ)
    connect(client, "tcp://localhost:10000")
    client
end

function send_msg(client, msg)
    send(client, JSON.json(Dict(:code=>msg)))
    resp = recv(client)
    d = JSON.parse(unsafe_string(resp))
    d["result"]
end
