package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"{{MODULE}}/api"
	"{{MODULE}}/config"
	"{{MODULE}}/models"
	"{{MODULE}}/utils"
)

func (s *Server) GetProfile(c *gin.Context) {
	userID, ok := c.Get("userID")
	if !ok {
		utils.Error(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		utils.Error(c, http.StatusNotFound, "User not found")
		return
	}

	utils.Success(c, http.StatusOK, toAPIUser(user))
}

func (s *Server) UpdateProfile(c *gin.Context) {
	var body api.UpdateProfileRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	userID, ok := c.Get("userID")
	if !ok {
		utils.Error(c, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		utils.Error(c, http.StatusNotFound, "User not found")
		return
	}

	// Only full_name is editable; email/role/password must go through their own
	// endpoints. Sanitize is the final defense before saving, even though
	// "notags" already rejected HTML at bind time.
	if body.FullName != nil {
		user.FullName = utils.SanitizeText(*body.FullName)
	}

	if err := config.DB.Save(&user).Error; err != nil {
		utils.Error(c, http.StatusInternalServerError, "Failed to update profile")
		return
	}

	utils.Success(c, http.StatusOK, toAPIUser(user))
}
