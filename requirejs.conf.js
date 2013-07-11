require.config({
  baseUrl: "/buzzfyrejs/",
  paths: {
    jquery: 'lib/jquery/jquery',
    base64: 'lib/base64/base64'
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