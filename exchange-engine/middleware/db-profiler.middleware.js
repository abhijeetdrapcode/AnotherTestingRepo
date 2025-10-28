const profileMongoMethod = (collection, methodName) => {
  const original = collection[methodName];
  collection[methodName] = function (...args) {
    const start = process.hrtime();

    const result = original.apply(this, args);

    // If result is a Promise (e.g., insertOne), time it
    if (result && typeof result.then === 'function') {
      return result.then((res) => {
        logMongoTime(methodName, collection.collectionName, start);
        return res;
      });
    }

    // If result is a Cursor (e.g., aggregate or find), wrap toArray
    if (result && typeof result.toArray === 'function') {
      const originalToArray = result.toArray.bind(result);
      result.toArray = async function () {
        const res = await originalToArray();
        logMongoTime(methodName, collection.collectionName, start);
        return res;
      };
      return result;
    }

    // Default fallback
    return result;
  };
};

function logMongoTime(method, collection, start) {
  const diff = process.hrtime(start);
  const ms = (diff[0] * 1e3 + diff[1] / 1e6).toFixed(2);
  console.log(
    JSON.stringify({
      type: 'mongo',
      method,
      collection,
      duration: `${ms}ms`,
    }),
  );
}

export const dbProfiler = (collection) => {
  const methods = ['find', 'findOne', 'insertOne', 'updateOne', 'deleteOne', 'aggregate'];
  methods.forEach((method) => {
    if (typeof collection[method] === 'function') {
      profileMongoMethod(collection, method);
    }
  });
  return collection;
};
