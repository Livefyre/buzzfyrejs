require.config({
  baseUrl: "/",
  paths: {
    jquery: 'lib/jquery/jquery'
  },
  packages: [{
     name: "buzzfyrejs",
     location: "./src/javascript"
  },{
     name: "streamhub-sdk",
     location: "lib/streamhub-sdk/src/"
  }],
  shim: {
    jquery: {
        exports: '$'
    }
  }
});