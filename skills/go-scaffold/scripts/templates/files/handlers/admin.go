package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"{{MODULE}}/api"
	"{{MODULE}}/config"
	"{{MODULE}}/models"
	"{{MODULE}}/utils"
)

func (s *Server) ListUsers(c *gin.Context, params api.ListUsersParams) {
	page := 1
	if params.Page != nil && *params.Page >= 1 {
		page = *params.Page
	}
	limit := 20
	if params.Limit != nil && *params.Limit >= 1 && *params.Limit <= 100 {
		limit = *params.Limit
	}
	offset := (page - 1) * limit

	var users []models.User
	var total int64

	config.DB.Model(&models.User{}).Count(&total)
	if err := config.DB.Limit(limit).Offset(offset).Order("id asc").Find(&users).Error; err != nil {
		utils.Error(c, http.StatusInternalServerError, "Failed to fetch users")
		return
	}

	utils.Success(c, http.StatusOK, api.UserListResponse{
		Data:  toAPIUserList(users),
		Page:  page,
		Limit: limit,
		Total: int(total),
	})
}

func (s *Server) UpdateUserRole(c *gin.Context, id int) {
	var body api.UpdateRoleRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	var user models.User
	if err := config.DB.First(&user, id).Error; err != nil {
		utils.Error(c, http.StatusNotFound, "User not found")
		return
	}

	// Prevent an admin from demoting their own account
	if requesterID, ok := c.Get("userID"); ok {
		if requesterID.(uint) == uint(id) && body.Role != api.UpdateRoleRequestRoleAdmin {
			utils.Error(c, http.StatusBadRequest, "Cannot demote your own account")
			return
		}
	}

	user.Role = string(body.Role)
	if err := config.DB.Save(&user).Error; err != nil {
		utils.Error(c, http.StatusInternalServerError, "Failed to update role")
		return
	}

	utils.Success(c, http.StatusOK, toAPIUser(user))
}

func (s *Server) DeleteUser(c *gin.Context, id int) {
	// Prevent an admin from deleting their own account
	if requesterID, ok := c.Get("userID"); ok {
		if requesterID.(uint) == uint(id) {
			utils.Error(c, http.StatusBadRequest, "Cannot delete your own account")
			return
		}
	}

	if err := config.DB.Delete(&models.User{}, id).Error; err != nil {
		utils.Error(c, http.StatusInternalServerError, "Failed to delete user")
		return
	}

	utils.Success(c, http.StatusOK, api.MessageResponse{Message: "User deleted successfully"})
}
