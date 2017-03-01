using ZMQ
using JSON

ctx = Context()

server = Socket(ctx, ROUTER)

bind(server, "tcp://*:10000")

module Client
end

function slack_escape(msg::AbstractString)
    for (target, replacement) in [
            ("&", "amp"),
            ("<", "lt"),
            (">", "gt")]
        msg = replace(msg, target, "&$(replacement);")
    end
    return msg
end

slack_escape(msg) = msg

while true
    addr = recv(server)
    msg = recv(server)
    parsed_msg = JSON.parse(unsafe_string(msg))
    code = parsed_msg["code"]
    for fancy_quote in ["”", "“"]
        code = replace(code, fancy_quote, "\"")
    end
    info("Got code $code")
    output = Dict()
    output[:message_id] = parsed_msg["message_id"]
    old_stdout = STDOUT
    new_stdout, _ = redirect_stdout()
    print('a')  # To make 'readavailable' below work
    try
        result = eval(Client, parse(code))
        output[:result] = string(result)
        output[:kind] = :normal
        output[:type] = string(typeof(result))
    catch err
        output[:result] = string(err)
        output[:kind] = :error
        output[:type] = string(typeof(err))
    finally
        redirect_stdout(old_stdout)
        output[:stdout] = String(readavailable(new_stdout))[2:end]
    end
    info("Sending back $output")
    for key in [:stdout, :result, :type]
        output[key] = slack_escape(output[key])
    end
    send(server, addr, true)
    send(server, JSON.json(output))
end
