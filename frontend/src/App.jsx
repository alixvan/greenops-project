import { useState } from "react";
import axios from "axios";

function App() {
  const [isLogin, setIsLogin] = useState(true);

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [token, setToken] = useState("");
  const [profile, setProfile] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async () => {
    try {
      if (isLogin) {
        const response = await axios.post(
          "/api/login",
          {
            email: formData.email,
            password: formData.password,
          }
        );

        setToken(response.data.token);

        alert("Connexion réussie !");
      } else {
        await axios.post(
          "/api/register",
          formData
        );

        alert(
          "Compte créé, connectez-vous"
        );

        setIsLogin(true);
      }
    } catch (error) {
      alert("Erreur");
      console.error(error);
    }
  };

  const getProfile = async () => {
    try {
      const response = await axios.get(
        "/api/profile",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log(response.data);
      
      setProfile(response.data.user);
    } catch (error) {
      alert("Accès refusé");
    }
  };

  return (
    <div
      style={{
        maxWidth: 400,
        margin: "50px auto",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <h1>
        {isLogin
          ? "Connexion"
          : "Inscription"}
      </h1>

      {!isLogin && (
        <input
          name="username"
          placeholder="Nom utilisateur"
          onChange={handleChange}
        />
      )}

      <input
        name="email"
        placeholder="Email"
        onChange={handleChange}
      />

      <input
        name="password"
        type="password"
        placeholder="Mot de passe"
        onChange={handleChange}
      />

      <button onClick={handleSubmit}>
        {isLogin
          ? "Se connecter"
          : "Créer un compte"}
      </button>

      <button
        onClick={() =>
          setIsLogin(!isLogin)
        }
      >
        Changer mode
      </button>

      {token && (
        <button onClick={getProfile}>
          Charger profil
        </button>
      )}

      {profile && (
        <div
          style={{
            marginTop: 20,
            padding: 20,
            border: "1px solid gray",
          }}
        >
          <h2>Bienvenue</h2>

          <p>
            <strong>ID :</strong>{" "}
            {profile.id}
          </p>

          <p>
            <strong>Email :</strong>{" "}
            {profile.email}
          </p>

          <p>
            <strong>Role :</strong>{" "}
            {profile.role}
          </p>

          {profile.role === "admin" && (
            <button
              onClick={() =>
                alert("Bienvenue administrateur")
              }
            >
              Zone Admin
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default App;