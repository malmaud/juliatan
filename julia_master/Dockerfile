FROM ontouchstart/julia-nightly
RUN julia -e "Pkg.add(\"ZMQ\"); Pkg.add(\"JSON\");"
ADD script.jl /
CMD julia /script.jl
