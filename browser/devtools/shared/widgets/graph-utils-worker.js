self.onmessage = (event) => {
  console.log("GO");
  const { data: { type, id, data } } = event;

  try {
    if (type === "sparsifyLineData") {
      let sparseData = sparsifyLineData(data);
      self.postMessage({
        id: id,
        data: sparseData
      });
    }
  } catch (e) {
    self.postMessage({
      id: id,
      error: e.message + "\n" + e.stack
    });
  }
};

function sparsifyLineData (data) {
  return data;
}
