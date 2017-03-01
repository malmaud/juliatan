FROM julia
RUN apt-get update -y
RUN apt-get install -y libzmq3-dev
RUN julia -e "Pkg.add(\"ZMQ\"); Pkg.add(\"JSON\");"
ADD script.jl /
CMD julia /script.jl
