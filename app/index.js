import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Platform } from 'react-native';
import axios from 'axios';
import * as Location from 'expo-location';
import { FontAwesome5 } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

// Function to get icon name based on weather ID from the API
const getWeatherIcon = (id) => {
    if (id >= 200 && id < 300) {
        return "cloud-showers-heavy"; // Thunderstorm
    } else if (id >= 300 && id < 500) {
        return "cloud-drizzle"; // Drizzle
    } else if (id >= 500 && id < 600) {
        return "cloud-rain"; // Rain
    } else if (id >= 600 && id < 700) {
        return "snowflake"; // Snow
    } else if (id >= 700 && id < 800) {
        return "smog"; // Atmosphere
    } else if (id === 800) {
        return "sun"; // Clear
    } else if (id > 800 && id < 900) {
        return "cloud"; // Clouds
    }
    return "question-circle"; // Fallback icon
};

// Function to get background color based on weather ID
const getWeatherColor = (id) => {
    if (id >= 200 && id < 300) return '#4f4f4f'; // Thunderstorm
    if (id >= 300 && id < 500) return '#b5c5c9'; // Drizzle
    if (id >= 500 && id < 600) return '#8aa8b6'; // Rain
    if (id >= 700 && id < 800) return '#e0eaf3'; // Snow
    if (id >= 700 && id < 800) return '#b0c4de'; // Atmosphere
    if (id === 800) return '#87ceeb'; // Clear
    if (id > 800 && id < 900) return '#c0d6e4'; // Clouds
    return '#f0f4f7'; // Default
};

const getAqiDescription = (aqi) => {
    if (aqi === 1) return { text: "Good", color: "green" };
    if (aqi === 2) return { text: "Fair", color: "#66CD00" };
    if (aqi === 3) return { text: "Moderate", color: "yellow" };
    if (aqi === 4) return { text: "Poor", color: "orange" };
    if (aqi === 5) return { text: "Very Poor", color: "red" };
    return { text: "N/A", color: "gray" };
};

const API_KEY = '493647375a7f40528198f56dcc8c2a61';

export default function WeatherApp() {
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [hourlyForecast, setHourlyForecast] = useState(null);
  const [city, setCity] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [unit, setUnit] = useState('C'); // 'C' for Celsius, 'F' for Fahrenheit
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [aqi, setAqi] = useState(null);
  const [uvIndex, setUvIndex] = useState(null);

  // Shared values for animations
  const weatherOpacity = useSharedValue(0);
  const forecastOpacity = useSharedValue(0);
  const hourlyOpacity = useSharedValue(0);
  const weatherIconScale = useSharedValue(1);

  const convertTemp = (kelvinTemp) => {
    if (unit === 'F') {
      return `${Math.round((kelvinTemp - 273.15) * 9/5 + 32)}°F`;
    }
    return `${Math.round(kelvinTemp - 273.15)}°C`;
  };

  const fetchWeather = async (cityName) => {
    setIsLoading(true);
    setError('');
    setWeather(null);
    setForecast(null);
    setHourlyForecast(null);
    setAqi(null);
    setUvIndex(null);

    // Reset animations
    weatherOpacity.value = withTiming(0);
    forecastOpacity.value = withTiming(0);
    hourlyOpacity.value = withTiming(0);
    weatherIconScale.value = withTiming(0);
    
    try {
      const geoResponse = await axios.get(
        `https://api.openweathermap.org/geo/1.0/direct?q=${cityName}&limit=1&appid=${API_KEY}`
      );
      if (geoResponse.data.length === 0) {
        setError('Could not find that city.');
        setIsLoading(false);
        return;
      }
      const { lat, lon } = geoResponse.data[0];

      const [weatherResponse, forecastResponse, airPollutionResponse] = await Promise.all([
        axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}`),
        axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}`),
        axios.get(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`),
      ]);
      
      setWeather(weatherResponse.data);
      const dailyData = forecastResponse.data.list.filter(item => item.dt_txt.includes("12:00:00"));
      setForecast(dailyData);
      
      const hourlyData = forecastResponse.data.list.slice(0, 8); // Get the next 24 hours (8 entries of 3 hours)
      setHourlyForecast(hourlyData);
      
      setAqi(airPollutionResponse.data.list[0]?.main?.aqi || null);
      setUvIndex(weatherResponse.data?.current?.uvi || null);

      // Animate in the content after data is fetched
      weatherOpacity.value = withTiming(1, { duration: 500 });
      forecastOpacity.value = withTiming(1, { duration: 500 });
      hourlyOpacity.value = withTiming(1, { duration: 500 });
      weatherIconScale.value = withTiming(1, { duration: 500 });

    } catch (err) {
      console.error(err);
      setError('Could not fetch weather data. Please try again.');
      // Animate out content on error
      weatherOpacity.value = withTiming(0, { duration: 300 });
    } finally {
        setIsLoading(false);
    }
  };

  const fetchWeatherByLocation = async () => {
    setIsLoading(true);
    setError('');
    setWeather(null);
    setForecast(null);
    setHourlyForecast(null);
    setAqi(null);
    setUvIndex(null);
    
    // Request location permission
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission to access location was denied.');
      setIsLoading(false);
      return;
    }

    try {
      let location = await Location.getCurrentPositionAsync({});
      const geocodeResponse = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (geocodeResponse.length > 0) {
        const detectedCity = geocodeResponse[0].city;
        setCity(detectedCity); // Set the city in the input field
        await fetchWeather(detectedCity);
      } else {
        setError('Could not determine city from location.');
        setIsLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to get location or weather data.');
      setIsLoading(false);
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim() || !weather) return;

    const userMessage = chatInput.trim();
    setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);
    setChatInput('');
    setIsChatting(true);

    const prompt = `You are a helpful AI weather assistant. Provide a concise, conversational summary based on the following weather data for ${weather.name}. 
    Current Weather:
    - Temperature: ${convertTemp(weather.main.temp)}
    - Description: ${weather.weather[0].description}
    - Humidity: ${weather.main.humidity}%
    - Wind Speed: ${weather.wind.speed} m/s
    - AQI: ${aqi ? getAqiDescription(aqi).text : 'N/A'}
    - UV Index: ${uvIndex !== null ? uvIndex : 'N/A'}
    
    5-Day Forecast:
    ${forecast.map(item => `- Date: ${new Date(item.dt * 1000).toDateString()}, Temp: ${convertTemp(item.main.temp)}, Description: ${item.weather[0].description}`).join('\n')}

    User's question: ${userMessage}
    `;

    try {
      const payload = {
          contents: [{ parts: [{ text: prompt }] }],
      };
      const apiKey = "" 
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });
      const result = await response.json();
      const botResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
      setChatHistory(prev => [...prev, { role: 'bot', text: botResponse }]);

    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { role: 'bot', text: 'Error: Could not connect to the AI service.' }]);
    } finally {
      setIsChatting(false);
    }
  };

  useEffect(() => {
    // Fetch weather for the current location when the app loads
    fetchWeatherByLocation();
  }, []); // Empty dependency array means this runs only once on mount

  const weatherAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: weatherOpacity.value,
      transform: [{ scale: weatherIconScale.value }],
    };
  });

  const fadeAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: weatherOpacity.value,
    };
  });

  return (
    <ScrollView 
      contentContainerStyle={styles.container} 
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: weather ? getWeatherColor(weather.weather[0].id) : '#f0f4f7' }}
    >
      <Text style={styles.title}>WeatherApp</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter city name"
        onChangeText={setCity}
        value={city}
      />
      <TouchableOpacity style={styles.button} onPress={() => fetchWeather(city)}>
        <Text style={styles.buttonText}>Get Weather</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.locationButton} onPress={fetchWeatherByLocation}>
        <Text style={styles.buttonText}>My Location</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.unitButton}
        onPress={() => setUnit(unit === 'C' ? 'F' : 'C')}
      >
        <Text style={styles.unitButtonText}>Switch to {unit === 'C' ? '°F' : '°C'}</Text>
      </TouchableOpacity>

      {isLoading && <Text style={styles.loadingText}>Loading...</Text>}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {weather && (
        <Animated.View style={[styles.weatherContainer, fadeAnimatedStyle]}>
          <Text style={styles.cityName}>{weather.name}</Text>
          <Animated.View style={weatherAnimatedStyle}>
            <FontAwesome5 name={getWeatherIcon(weather.weather[0].id)} size={64} color="#007bff" />
          </Animated.View>
          <Text style={styles.temperature}>{convertTemp(weather.main.temp)}</Text>
          <Text style={styles.description}>{weather.weather[0].description}</Text>
          <Text style={styles.detail}>Humidity: {weather.main.humidity}%</Text>
          <Text style={styles.detail}>Wind Speed: {weather.wind.speed} m/s</Text>
          
          <View style={styles.sunContainer}>
            <View style={styles.sunItem}>
              <FontAwesome5 name="sun" size={20} color="#ff9800" />
              <Text style={styles.sunText}>Sunrise</Text>
              <Text style={styles.sunTime}>
                {new Date(weather.sys.sunrise * 1000).toLocaleTimeString()}
              </Text>
            </View>
            <View style={styles.sunItem}>
              <FontAwesome5 name="moon" size={20} color="#9c27b0" />
              <Text style={styles.sunText}>Sunset</Text>
              <Text style={styles.sunTime}>
                {new Date(weather.sys.sunset * 1000).toLocaleTimeString()}
              </Text>
            </View>
          </View>
        </Animated.View>
      )}

      {aqi && uvIndex !== null && (
        <Animated.View style={[styles.infoContainer, fadeAnimatedStyle]}>
            <View style={styles.infoItem}>
                <FontAwesome5 name="smog" size={24} color={getAqiDescription(aqi).color} />
                <Text style={styles.infoValue}>AQI: {aqi}</Text>
                <Text style={styles.infoLabel}>({getAqiDescription(aqi).text})</Text>
            </View>
            <View style={styles.infoItem}>
                <FontAwesome5 name="sun" size={24} color="#f9a825" />
                <Text style={styles.infoValue}>UV Index: {uvIndex}</Text>
                <Text style={styles.infoLabel}>({uvIndex > 7 ? 'High' : 'Low'})</Text>
            </View>
        </Animated.View>
      )}
      
      {hourlyForecast && (
        <Animated.View style={[styles.hourlyContainer, fadeAnimatedStyle]}>
          <Text style={styles.hourlyTitle}>Hourly Forecast</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {hourlyForecast.map((item) => (
              <View key={item.dt} style={styles.hourlyItem}>
                <Text style={styles.hourlyTime}>{new Date(item.dt * 1000).getHours()}:00</Text>
                <FontAwesome5 name={getWeatherIcon(item.weather[0].id)} size={24} color="#007bff" />
                <Text style={styles.hourlyTemp}>{convertTemp(item.main.temp)}</Text>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {forecast && (
        <Animated.View style={[styles.forecastContainer, fadeAnimatedStyle]}>
          <Text style={styles.forecastTitle}>5-Day Forecast</Text>
          {forecast.map((item) => (
            <View key={item.dt} style={styles.forecastItem}>
              <Text style={styles.forecastDate}>{new Date(item.dt * 1000).toDateString()}</Text>
              <FontAwesome5 name={getWeatherIcon(item.weather[0].id)} size={24} color="#007bff" />
              <Text style={styles.forecastTemp}>{convertTemp(item.main.temp)}</Text>
            </View>
          ))}
        </Animated.View>
      )}

      {weather && (
        <View style={styles.chatContainer}>
          <Text style={styles.chatTitle}>Chat with AI Weather Assistant</Text>
          <ScrollView style={styles.chatHistory}>
            {chatHistory.map((msg, index) => (
              <View key={index} style={[
                styles.chatMessage,
                msg.role === 'user' ? styles.userMessage : styles.botMessage
              ]}>
                <Text>{msg.text}</Text>
              </View>
            ))}
            {isChatting && (
                <View style={[styles.chatMessage, styles.botMessage]}>
                    <Text>Typing...</Text>
                </View>
            )}
          </ScrollView>
          <View style={styles.chatInputContainer}>
            <TextInput
              style={styles.chatInput}
              placeholder="Ask me a question about the weather..."
              onChangeText={setChatInput}
              value={chatInput}
              editable={!isChatting}
            />
            <TouchableOpacity 
              style={styles.chatButton} 
              onPress={handleChat} 
              disabled={isChatting}
            >
              <Text style={styles.chatButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1, // Use flexGrow instead of flex: 1 for ScrollView
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 25,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 15,
    borderRadius: 25,
    width: '100%',
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    marginBottom: 10,
  },
  locationButton: {
    backgroundColor: '#28a745',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    marginBottom: 10,
  },
  unitButton: {
    backgroundColor: '#ffc107',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    marginBottom: 15,
  },
  unitButtonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  weatherContainer: {
    marginTop: 30,
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    width: '100%',
  },
  cityName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  temperature: {
    fontSize: 52,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 10,
  },
  description: {
    fontSize: 18,
    color: '#666',
    textTransform: 'capitalize',
    marginBottom: 10,
  },
  detail: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    color: '#666',
  },
  errorText: {
    marginTop: 20,
    fontSize: 16,
    color: 'red',
  },
  hourlyContainer: {
    marginTop: 20,
    width: '100%',
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  hourlyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  hourlyItem: {
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  hourlyTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  hourlyTemp: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 5,
  },
  forecastContainer: {
    marginTop: 20,
    width: '100%',
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  forecastItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  forecastDate: {
    fontSize: 14,
    color: '#666',
  },
  forecastTemp: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  sunContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  sunItem: {
    alignItems: 'center',
  },
  sunText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  sunTime: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  chatContainer: {
    marginTop: 20,
    width: '100%',
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  chatTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  chatHistory: {
    height: 200, // Fixed height for chat history
    marginBottom: 10,
  },
  chatMessage: {
    padding: 10,
    borderRadius: 15,
    marginVertical: 5,
  },
  userMessage: {
    backgroundColor: '#e6f3ff', // Light blue for user messages
    alignSelf: 'flex-end',
    maxWidth: '80%',
    borderBottomRightRadius: 2,
  },
  botMessage: {
    backgroundColor: '#f0f0f0', // Light gray for bot messages
    alignSelf: 'flex-start',
    maxWidth: '80%',
    borderBottomLeftRadius: 2,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#fff',
  },
  chatButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 20,
  },
  chatButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  infoItem: {
    alignItems: 'center',
  },
  infoValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 5,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
});
