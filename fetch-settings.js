fetch('http://localhost:3000/api/settings')
  .then(res => res.json())
  .then(data => console.log(data));
