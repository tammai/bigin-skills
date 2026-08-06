package handlers

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"{{MODULE}}/api"
	"{{MODULE}}/config"
	"{{MODULE}}/models"
	"{{MODULE}}/utils"
)

// SignUp registers a new user. The request body is bound into the generated
// api.SignUpRequest type, whose binding tags (required, email, min, notags)
// were carried over from the contract via x-oapi-codegen-extra-tags.
func (s *Server) SignUp(c *gin.Context) {
	var body api.SignUpRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := utils.ValidatePasswordComplexity(body.Password); err != nil {
		utils.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	// Normalize before querying/saving — avoids duplicate accounts differing
	// only by case, and sanitize acts as the final defense even though "notags"
	// already rejected HTML at bind time.
	email := utils.NormalizeEmail(string(body.Email))
	fullName := utils.SanitizeText(body.FullName)

	var existing models.User
	err := config.DB.Where("email = ?", email).First(&existing).Error
	if err == nil {
		utils.Error(c, http.StatusConflict, "Email already registered")
		return
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		utils.Error(c, http.StatusInternalServerError, "Database error")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		utils.Error(c, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	user := models.User{
		Email:        email,
		PasswordHash: string(hash),
		FullName:     fullName,
		Role:         "user", // always force the default role, never trust role from the client
	}

	if err := config.DB.Create(&user).Error; err != nil {
		utils.Error(c, http.StatusInternalServerError, "Failed to create user")
		return
	}

	utils.Success(c, http.StatusCreated, toAPIUser(user))
}

func (s *Server) Login(c *gin.Context) {
	var body api.LoginRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	email := utils.NormalizeEmail(string(body.Email))

	var user models.User
	if err := config.DB.Where("email = ?", email).First(&user).Error; err != nil {
		utils.Error(c, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(body.Password)); err != nil {
		utils.Error(c, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	accessToken, err := utils.GenerateAccessToken(user.ID, user.Role)
	if err != nil {
		utils.Error(c, http.StatusInternalServerError, "Failed to generate access token")
		return
	}

	rawRefresh, refreshHash, err := utils.GenerateRefreshToken()
	if err != nil {
		utils.Error(c, http.StatusInternalServerError, "Failed to generate refresh token")
		return
	}

	refreshRecord := models.RefreshToken{
		UserID:    user.ID,
		TokenHash: refreshHash,
		ExpiresAt: time.Now().Add(utils.RefreshTokenExpiry()),
	}
	if err := config.DB.Create(&refreshRecord).Error; err != nil {
		utils.Error(c, http.StatusInternalServerError, "Failed to persist refresh token")
		return
	}

	utils.Success(c, http.StatusOK, api.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: rawRefresh,
		User:         toAPIUser(user),
	})
}

// Refresh: exchange a valid refresh token for a new access token.
// Uses rotation — the old refresh token is revoked immediately and a new one
// is issued, so a stolen token that gets reused is detected as a replay.
func (s *Server) Refresh(c *gin.Context) {
	var body api.RefreshRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	hash := utils.HashToken(body.RefreshToken)

	var stored models.RefreshToken
	if err := config.DB.Where("token_hash = ?", hash).First(&stored).Error; err != nil {
		utils.Error(c, http.StatusUnauthorized, "Invalid refresh token")
		return
	}

	if stored.Revoked || time.Now().After(stored.ExpiresAt) {
		utils.Error(c, http.StatusUnauthorized, "Refresh token expired or revoked")
		return
	}

	var user models.User
	if err := config.DB.First(&user, stored.UserID).Error; err != nil {
		utils.Error(c, http.StatusUnauthorized, "User not found")
		return
	}

	stored.Revoked = true
	config.DB.Save(&stored)

	accessToken, err := utils.GenerateAccessToken(user.ID, user.Role)
	if err != nil {
		utils.Error(c, http.StatusInternalServerError, "Failed to generate access token")
		return
	}

	rawRefresh, refreshHash, err := utils.GenerateRefreshToken()
	if err != nil {
		utils.Error(c, http.StatusInternalServerError, "Failed to generate refresh token")
		return
	}

	newRefresh := models.RefreshToken{
		UserID:    user.ID,
		TokenHash: refreshHash,
		ExpiresAt: time.Now().Add(utils.RefreshTokenExpiry()),
	}
	if err := config.DB.Create(&newRefresh).Error; err != nil {
		utils.Error(c, http.StatusInternalServerError, "Failed to persist refresh token")
		return
	}

	utils.Success(c, http.StatusOK, api.TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: rawRefresh,
	})
}

// Logout: revoke the refresh token so it can no longer be used to obtain a new
// access token. Existing access tokens remain valid until they expire naturally
// (JWTs are stateless).
func (s *Server) Logout(c *gin.Context) {
	var body api.LogoutRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	hash := utils.HashToken(body.RefreshToken)

	if err := config.DB.Model(&models.RefreshToken{}).
		Where("token_hash = ?", hash).
		Update("revoked", true).Error; err != nil {
		utils.Error(c, http.StatusInternalServerError, "Failed to logout")
		return
	}

	utils.Success(c, http.StatusOK, api.MessageResponse{Message: "Logged out successfully"})
}
