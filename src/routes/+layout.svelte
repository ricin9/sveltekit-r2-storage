<nav>
  <ul>
    <li><a href="/">normal upload</a></li>
    <li><a href="/multipart-upload">multipart upload</a></li>
  </ul>
</nav>
<slot />

<style>
  nav {
    display: flex;
    justify-content: center;
    margin: 1rem;
  }

  ul {
    display: flex;
    list-style: none;
    padding: 0;
  }

  li {
    margin: 0 1rem;
  }

  a {
    text-decoration: none;
    color: blue;
  }
</style>
