FROM node
RUN apt-get update -y
RUN apt-get install -y libzmq3-dev
RUN mkdir /project
WORKDIR /project
ADD package.json /project
RUN npm install .
ADD src /project/src
ADD lib /project/lib
ADD run_devserver.sh /project
ADD .babelrc /project
CMD npm run serve
