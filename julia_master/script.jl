using ZMQ
using JSON

ctx = Context()

server = Socket(ctx, REP)

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
    msg = recv(server)
    d = JSON.parse(unsafe_string(msg))
    code = d["code"]
    for fancy_quote in ["”", "“"]
        code = replace(code, fancy_quote, "\"")
    end
    info("Got code $code")
    output = Dict()
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
    send(server, JSON.json(output))
end
