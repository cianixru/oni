const Configuration = jest.fn().mockImplementation(() => {
    return {
        notifyListeners: jest.fn(),
        updateConfig: jest.fn(),
    }
})

export const configuration = new Configuration()
export default Configuration
