/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          primary: {
            50: '#E3F2FD',
            100: '#BBDEFB',
            500: '#1E88E5',
            600: '#1976D2',
          },
          accent: {
            50: '#FFF8E1',
            100: '#FFECB3',
            500: '#FFB300',
            600: '#FF8F00',
          },
          gray: {
            50: '#FAFAFA',
            100: '#F5F5F5',
            200: '#EEEEEE',
            400: '#BDBDBD',
            600: '#757575',
            700: '#555555',
            900: '#222222',
          },
          page: '#F5F5F7',
        },
        fontSize: {
          'xs': '12px',
          'sm': '13px',
          'base': '15px',
          'lg': '17px',
          'xl': '20px',
          '2xl': '24px',
          '3xl': '28px',
        },
        boxShadow: {
          'card-sm': '0px 2px 8px rgba(0, 0, 0, 0.04)',
          'card': '0px 4px 12px rgba(0, 0, 0, 0.06)',
          'card-lg': '0px 8px 24px rgba(0, 0, 0, 0.08)',
        },
        borderRadius: {
          'card': '16px',
          'card-lg': '20px',
        },
      },
    },
    plugins: [],
  }