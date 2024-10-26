const { execFile } = require('child_process');

const runModel = (script, data) => {
    return new Promise((resolve, reject) => {
      const input = JSON.stringify(data);
      execFile('python3', [script, input], (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          console.log("Model results:",script, JSON.parse(stdout));
          resolve(JSON.parse(stdout));
        }
      });
    });
  };

module.exports={runModel}